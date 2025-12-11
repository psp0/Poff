const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const FileSystemLoader = require('./loaders/fs-loader');
const S3Loader = require('./loaders/s3-loader');
const PokemonParser = require('./parser');

// Database client (MySQL for both local and RDS)
const mysql = require('mysql2/promise');

async function main() {
    const isProduction = process.env.NODE_ENV === 'production';

    console.log('==========================================');
    console.log('🌟 Pokemon Data Seeder');
    console.log('==========================================');
    console.log(`Environment: ${isProduction ? 'PRODUCTION (GHA → RDS)' : 'DEVELOPMENT (local → MySQL)'}`);

    // 1. Initialize asset loader based on environment
    const loader = isProduction
        ? new S3Loader(process.env.S3_BUCKET_NAME, process.env.S3_BASE_PATH || '')
        : new FileSystemLoader(process.env.ASSETS_DIR || '../pokehabit-assets');

    // 2. Initialize database connection (MySQL for both local and RDS)
    const db = await connectMySQL();

    try {
        // 3. Parse Pokemon data
        console.log('\\n📦 Parsing Pokemon data...');
        const parser = new PokemonParser(loader);
        await parser.parseAll();

        // 4. Insert data into database
        console.log('\\n💾 Inserting data into database...');
        await insertPokemonData(db, parser);
        await insertFlags(db, parser);
        await insertFlagRelations(db, parser);
        await insertEvolutions(db, parser);

        // 5. Insert guest user Pokemon collection
        console.log('\\n🎮 Setting up guest user demo data...');
        await insertGuestUserPokemon(db);

        console.log('\\n✅ Seeding completed successfully!');
    } catch (error) {
        console.error('\\n❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await db.end();
        console.log('\\n🔌 Database connection closed');
    }
}

async function connectMySQL() {
    console.log('Connecting to MySQL...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    console.log(`✓ Connected to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    return connection;
}

async function insertPokemonData(db, parser) {
    const records = await parser.createPokemonRecords();

    console.log(`Inserting ${records.length} Pokemon records...`);
    let inserted = 0;

    for (const record of records) {
        // MySQL: ON DUPLICATE KEY UPDATE
        await db.query(`
            INSERT INTO pokemon (
              name, category, type1, type2, type1_en, type2_en,
              pokedex, generation, habitat, habitat_en, height, weight,
              base_hp, base_attack, base_defense, base_sp_attack,
              base_sp_defense, base_speed, base_stat_total,
              image_name, form_suffix, asset_source,
              has_icon, has_icon_shiny, has_front, has_front_shiny, has_back, has_back_shiny, has_cry,
              back_animation_speed, front_animation_speed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              category = VALUES(category),
              type1 = VALUES(type1),
              type2 = VALUES(type2),
              type1_en = VALUES(type1_en),
              type2_en = VALUES(type2_en),
              asset_source = VALUES(asset_source),
              has_icon = VALUES(has_icon),
              has_icon_shiny = VALUES(has_icon_shiny),
              has_front = VALUES(has_front),
              has_front_shiny = VALUES(has_front_shiny),
              has_back = VALUES(has_back),
              has_back_shiny = VALUES(has_back_shiny),
              has_cry = VALUES(has_cry),
              back_animation_speed = VALUES(back_animation_speed),
              front_animation_speed = VALUES(front_animation_speed),
              updated_at = NOW()
        `, [
            record.name, record.category, record.type1, record.type2,
            record.type1_en, record.type2_en, record.pokedex,
            record.generation, record.habitat, record.habitat_en,
            record.height, record.weight, record.base_hp, record.base_attack,
            record.base_defense, record.base_sp_attack, record.base_sp_defense,
            record.base_speed, record.base_stat_total, record.image_name,
            record.form_suffix, record.asset_source,
            record.has_icon, record.has_icon_shiny, record.has_front, record.has_front_shiny, record.has_back, record.has_back_shiny, record.has_cry,
            record.back_animation_speed, record.front_animation_speed
        ]);

        inserted++;
        if (inserted % 100 === 0) {
            console.log(`  Progress: ${inserted}/${records.length}`);
        }
    }

    console.log(`✓ Inserted ${inserted} Pokemon records`);
}

async function insertFlags(db, parser) {
    const records = parser.createFlagRecords();
    console.log(`Inserting ${records.length} flag records...`);

    for (const record of records) {
        await db.query(
            'INSERT INTO pokemon_flags (name, name_ko) VALUES (?, ?) ON DUPLICATE KEY UPDATE name_ko = VALUES(name_ko)',
            [record.name, record.name_ko]
        );
    }

    console.log(`✓ Inserted ${records.length} flags`);
}

async function insertFlagRelations(db, parser) {
    const relations = parser.createFlagRelations();
    console.log(`Inserting ${relations.length} flag relations...`);

    // Clear existing relations
    await db.query('DELETE FROM pokemon_flag_relations');

    for (const rel of relations) {
        await db.query(
            'INSERT INTO pokemon_flag_relations (pokemon_stable_id, flag_name) VALUES (?, ?)',
            [rel.pokemon_stable_id, rel.flag_name]
        );
    }

    console.log(`✓ Inserted ${relations.length} flag relations`);
}

async function insertEvolutions(db, parser) {
    const evolutions = parser.createEvolutionRecords();
    console.log(`Inserting ${evolutions.length} evolution records...`);

    // Clear existing evolutions
    await db.query('DELETE FROM pokemon_evolutions');

    for (const evo of evolutions) {
        await db.query(
            'INSERT INTO pokemon_evolutions (from_pokemon, to_pokemon) VALUES (?, ?)',
            [evo.from_pokemon, evo.to_pokemon]
        );
    }

    console.log(`✓ Inserted ${evolutions.length} evolutions`);
}

// 게스트 유저의 포켓몬 컬렉션 초기 데이터 삽입
async function insertGuestUserPokemon(db) {
    const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';

    // 게스트 유저에게 줄 포켓몬 목록 - 4마리만 (1단계 포켓몬)
    const guestPokemon = [
        { stable_id: 'BULBASAUR', is_shiny: false, obtained_reason: '체험모드 기본 지급' },  // 이상해씨
        { stable_id: 'CHARMANDER', is_shiny: false, obtained_reason: '체험모드 기본 지급' }, // 파이리
        { stable_id: 'SQUIRTLE', is_shiny: false, obtained_reason: '체험모드 기본 지급' },   // 꼬부기
        { stable_id: 'PIKACHU', is_shiny: false, obtained_reason: '체험모드 기본 지급' }     // 피카켄
    ];

    console.log(`Inserting guest user Pokemon collection...`);
    let inserted = 0;
    let skipped = 0;

    for (const pokemon of guestPokemon) {
        try {
            // 해당 포켓몬이 실제로 존재하는지 확인
            const [rows] = await db.query(
                'SELECT stable_id FROM pokemon WHERE stable_id = ?',
                [pokemon.stable_id]
            );

            if (rows.length === 0) {
                console.log(`  ⚠ Pokemon ${pokemon.stable_id} not found, skipping...`);
                skipped++;
                continue;
            }

            await db.query(`
                INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, is_shiny, obtained_reason)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE obtained_reason = VALUES(obtained_reason)
            `, [GUEST_USER_ID, pokemon.stable_id, pokemon.is_shiny, pokemon.obtained_reason]);

            inserted++;
        } catch (err) {
            console.log(`  ⚠ Failed to insert ${pokemon.stable_id}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`✓ Guest user Pokemon: ${inserted} inserted, ${skipped} skipped`);
}

main().catch(console.error);
