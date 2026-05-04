const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');

/**
 * 포켓몬 관리 Lambda 함수 (진화, 폼 체인지 등)
 * 
 * 지원하는 작업:
 * - POST /pokemon/evolve - 포켓몬 진화 (이상한 사탕 사용)
 * - POST /pokemon/unlock-form - 폼 해제 (신비의 부적 사용)
 * - GET /user/items - 사용자 아이템 보유량 조회
 */

const handler = async (event, context) => {
    const db = getDatabase();
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;

    // [Fix] CloudFront origin_path adds stage prefix (e.g. /dev/api/...), so we need to strip it
    const stage = event.requestContext?.stage;
    let normalizedPath = path;
    if (stage && stage !== '$default' && path.startsWith(`/${stage}/`)) {
        normalizedPath = path.substring(stage.length + 1);
    }

    // Use normalizedPath for routing
    const routePath = normalizedPath;

    logger.info('Incoming Request', { path, method, query: event.queryStringParameters });

    if (method === 'POST' && routePath.endsWith('/pokemon/evolve')) {
        return await evolvePokemon(event, db);
    } else if (method === 'POST' && routePath.endsWith('/pokemon/unlock-form')) {
        return await unlockPokemonForm(event, db);
    } else if (method === 'POST' && routePath.endsWith('/pokemon/unlock-shiny')) {
        return await unlockShinyPokemon(event, db);
    } else if (method === 'GET' && routePath.endsWith('/user/items')) {
        return await getUserItems(event, db);
    } else {
        logger.warn('Route not found', { path, method });
        return createErrorResponse('Not Found', 404);
    }
};

/**
 * 사용자 아이템 보유량 조회
 */
async function getUserItems(event, db) {
    const auth = await authenticate(event);
    const queryParams = event.queryStringParameters || {};
    const userId = auth.isService ? queryParams.userId : auth.userId;

    if (!userId) {
        return createErrorResponse('User ID is required', 400);
    }

    try {
        const query = `
        SELECT 
          i.name, 
          i.name_ko, 
          i.image_name, 
          COALESCE(ui.quantity, 0) as quantity
        FROM items i
        LEFT JOIN user_items ui ON i.item_id = ui.item_id AND ui.user_id = ?
        WHERE i.name IN ('Rare Candy', 'Mystic Charm', 'Oval Charm', 'Shiny Charm', 'Awakening Charm', 'Brilliance Charm')
      `;

        const result = await db.query(query, [userId]);

        // 배열을 객체로 변환하여 반환 (키: item name)
        const items = {};
        result.rows.forEach(row => {
            items[row.name] = {
                name_ko: row.name_ko,
                quantity: row.quantity,
                image_name: row.image_name
            };
        });

        return createSuccessResponse(items);
    } catch (error) {
        logger.error('Error fetching user items', error);
        throw error;
    }
}

/**
 * 포켓몬 진화
 */
async function evolvePokemon(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);

    if (!userId) {
        return createErrorResponse('Unauthorized: User ID is missing', 401);
    }

    const { currentPokemonId, targetPokemonId } = requestBody;

    if (!currentPokemonId || !targetPokemonId) {
        return createErrorResponse('Current and Target Pokemon IDs are required', 400);
    }

    try {
        return await db.transaction(async (client) => {
            // 1. 포켓몬 정보 조회
            const pokemonInfo = await client.query(`
          SELECT stable_id, image_name, name FROM pokemon WHERE stable_id IN (?, ?)
        `, [currentPokemonId, targetPokemonId]);

            const currentP = pokemonInfo.rows.find(p => p.stable_id === currentPokemonId);
            const targetP = pokemonInfo.rows.find(p => p.stable_id === targetPokemonId);

            if (!currentP || !targetP) {
                throw new Error('포켓몬 정보를 찾을 수 없습니다.');
            }

            // 2. 사용자 보유 여부 확인 (해당 종의 아무 폼이나 가지고 있으면 됨)
            const ownershipCheck = await client.query(`
          SELECT 1 
          FROM user_pokemon_collection upc
          JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
          WHERE upc.user_id = ? AND p.image_name = ?
        `, [userId, currentP.image_name]);

            if (ownershipCheck.rows.length === 0) {
                // 디버깅을 위해 보유한 포켓몬 목록 조회
                const userPokemons = await client.query(`
                    SELECT p.stable_id, p.image_name 
                    FROM user_pokemon_collection upc
                    JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
                    WHERE upc.user_id = ?
                `, [userId]);
                logger.debug('User pokemon ownership check failed', {
                    ownedCount: userPokemons.rows.length,
                    requestedImageName: currentP.image_name
                });

                throw new Error('진화 전 포켓몬을 보유하고 있지 않습니다.');
            }

            // 진화 테이블에서 관계 확인
            const evolutionCheck = await client.query(`
          SELECT 1 FROM pokemon_evolutions 
          WHERE from_pokemon = ? AND to_pokemon = ?
        `, [currentP.image_name, targetP.image_name]);

            if (evolutionCheck.rows.length === 0) {
                throw new Error('유효한 진화 관계가 아닙니다.');
            }

            // 비용 계산: currentP가 pre-evolution이 있는지 확인
            const preEvolutionCheck = await client.query(`
              SELECT 1 FROM pokemon_evolutions WHERE to_pokemon = ?
            `, [currentP.image_name]);

            // 희귀한 포켓몬 여부 확인 (Legendary, Mythical, UltraBeast, Paradox)
            const rarePokemonCheck = await client.query(`
              SELECT 1 
              FROM pokemon_flag_relations pfr
              JOIN pokemon_flags pf ON pfr.flag_name = pf.name
              WHERE pfr.pokemon_stable_id = ? 
                AND pf.name IN ('Legendary', 'Mythical', 'UltraBeast', 'Paradox')
            `, [targetPokemonId]);

            let cost = 1;
            if (rarePokemonCheck.rows.length > 0) {
                // 희귀한 포켓몬은 사탕 3개 소모
                cost = 3;
            } else if (preEvolutionCheck.rows.length > 0) {
                // 이전에 진화한 기록이 있으면 (즉, Base가 아니면) 2단계 진화로 간주
                cost = 2;
            }

            // 3. 이상한 사탕 보유량 확인 및 차감
            const updateResult = await client.query(`
          UPDATE user_items ui
          JOIN items i ON ui.item_id = i.item_id
          SET ui.quantity = ui.quantity - ?, ui.updated_at = NOW()
          WHERE ui.user_id = ? 
            AND i.name = 'Rare Candy' 
            AND ui.quantity >= ?
        `, [cost, userId, cost]);

            if (updateResult.affectedRows === 0) {
                throw new Error(`이상한 사탕이 부족합니다...! (필요: ${cost}개)`);
            }

            // 4. 진화체 지급 (중복 확인)
            const targetOwnershipCheck = await client.query(`
          SELECT 1 FROM user_pokemon_collection 
          WHERE user_id = ? AND pokemon_stable_id = ?
        `, [userId, targetPokemonId]);

            if (targetOwnershipCheck.rows.length === 0) {
                await client.query(`
            INSERT INTO user_pokemon_collection (
              user_id, pokemon_stable_id, obtained_reason, obtained_date
            ) VALUES (?, ?, 'Evolution', NOW())
          `, [userId, targetPokemonId]);
            }

            logger.info('Pokemon evolved', { userId, currentPokemonId, targetPokemonId, cost });

            return createSuccessResponse({
                success: true,
                message: `...오잉!? ${currentP.name}의 모습이...!`,
                cost: cost,
                targetPokemonId: targetPokemonId
            });
        });
    } catch (error) {
        logger.error('Error evolving pokemon', error);
        throw error;
    }
}

/**
 * 폼 해제
 */
async function unlockPokemonForm(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);

    if (!userId) {
        return createErrorResponse('Unauthorized: User ID is missing', 401);
    }

    const { targetFormId } = requestBody;

    if (!targetFormId) {
        return createErrorResponse('Target Form ID is required', 400);
    }

    try {
        return await db.transaction(async (client) => {
            // 1. 타겟 폼의 기본(Base) 포켓몬 찾기
            const targetInfoResult = await client.query(`
          SELECT image_name, form_suffix, name FROM pokemon WHERE stable_id = ?
        `, [targetFormId]);

            if (targetInfoResult.rows.length === 0) {
                throw new Error('대상 포켓몬을 찾을 수 없습니다.');
            }

            const targetInfo = targetInfoResult.rows[0];
            const baseImageName = targetInfo.image_name;

            // 기본 폼의 한글 이름 가져오기
            const baseFormResult = await client.query(`
          SELECT name FROM pokemon WHERE image_name = ? AND form_suffix IS NULL
        `, [baseImageName]);

            const basePokemonName = baseFormResult.rows.length > 0
                ? baseFormResult.rows[0].name
                : targetInfo.name;

            // 2. 포켓몬 보유 여부 확인 (폼 무관, 해당 종을 가지고 있는지 확인)
            const ownershipCheck = await client.query(`
          SELECT 1 
          FROM user_pokemon_collection upc
          JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
          WHERE upc.user_id = ? AND p.image_name = ?
        `, [userId, baseImageName]);

            if (ownershipCheck.rows.length === 0) {
                // 디버깅을 위해 보유한 포켓몬 목록 조회
                const userPokemons = await client.query(`
                    SELECT p.stable_id, p.image_name 
                    FROM user_pokemon_collection upc
                    JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
                    WHERE upc.user_id = ?
                `, [userId]);
                logger.debug('User pokemon ownership check failed', {
                    ownedCount: userPokemons.rows.length,
                    requestedImageName: baseImageName
                });

                throw new Error('해당 포켓몬을 먼저 획득해야 합니다.');
            }

            // 3. 이미 보유 중인지 확인
            const targetOwnershipCheck = await client.query(`
          SELECT 1 FROM user_pokemon_collection 
          WHERE user_id = ? AND pokemon_stable_id = ?
        `, [userId, targetFormId]);

            if (targetOwnershipCheck.rows.length > 0) {
                throw new Error('이미 보유하고 있는 폼입니다.');
            }

            // 4. 희귀한 포켓몬 여부 확인 및 아이템 결정 (Legendary, Mythical, UltraBeast, Paradox)
            const rarePokemonCheck = await client.query(`
              SELECT 1 
              FROM pokemon_flag_relations pfr
              JOIN pokemon_flags pf ON pfr.flag_name = pf.name
              WHERE pfr.pokemon_stable_id = ? 
                AND pf.name IN ('Legendary', 'Mythical', 'UltraBeast', 'Paradox')
            `, [targetFormId]);

            const isRarePokemon = rarePokemonCheck.rows.length > 0;
            const requiredItemName = isRarePokemon ? 'Awakening Charm' : 'Mystic Charm';
            const requiredItemNameKo = isRarePokemon ? '각성의 부적' : '신비의 부적';
            const cost = 1;

            const updateResult = await client.query(`
              UPDATE user_items ui
              JOIN items i ON ui.item_id = i.item_id
              SET ui.quantity = ui.quantity - ?, ui.updated_at = NOW()
              WHERE ui.user_id = ? 
                AND i.name = ? 
                AND ui.quantity >= ?
            `, [cost, userId, requiredItemName, cost]);

            if (updateResult.affectedRows === 0) {
                throw new Error(`${requiredItemNameKo}이 부족합니다...!`);
            }

            // 5. 폼 지급
            await client.query(`
          INSERT INTO user_pokemon_collection (
            user_id, pokemon_stable_id, obtained_reason, obtained_date
          ) VALUES (?, ?, 'Form Unlock', NOW())
        `, [userId, targetFormId]);

            logger.info('Pokemon form unlocked', { userId, targetFormId, cost });

            return createSuccessResponse({
                success: true,
                message: `...오잉!? ${basePokemonName}의 모습이...!`,
                targetPokemonId: targetFormId
            });
        });
    } catch (error) {
        logger.error('Error unlocking pokemon form', error);
        throw error;
    }
}

/**
 * 이로치 해제
 */
async function unlockShinyPokemon(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);

    if (!userId) {
        return createErrorResponse('Unauthorized: User ID is missing', 401);
    }

    const { targetPokemonId } = requestBody;

    if (!targetPokemonId) {
        return createErrorResponse('Target Pokemon ID is required', 400);
    }

    try {
        return await db.transaction(async (client) => {
            // 1. 포켓몬 정보 조회
            const pokemonInfo = await client.query(`
                SELECT stable_id, image_name, name FROM pokemon WHERE stable_id = ?
            `, [targetPokemonId]);

            if (pokemonInfo.rows.length === 0) {
                throw new Error('포켓몬 정보를 찾을 수 없습니다.');
            }
            const pokemon = pokemonInfo.rows[0];

            // 2. 사용자 보유 여부 확인 (일반 버전은 있어야 함)
            const ownershipCheck = await client.query(`
                SELECT 1 FROM user_pokemon_collection 
                WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = false
            `, [userId, targetPokemonId]);

            if (ownershipCheck.rows.length === 0) {
                throw new Error('해당 포켓몬을 먼저 획득해야 합니다.');
            }

            // 3. 이미 이로치 보유 중인지 확인
            const shinyCheck = await client.query(`
                SELECT 1 FROM user_pokemon_collection 
                WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = true
            `, [userId, targetPokemonId]);

            if (shinyCheck.rows.length > 0) {
                throw new Error('이미 이로치 버전을 보유하고 있습니다.');
            }

            // 4. 희귀한 포켓몬 여부 확인 및 아이템 결정 (Legendary, Mythical, UltraBeast, Paradox)
            const rarePokemonCheck = await client.query(`
              SELECT 1 
              FROM pokemon_flag_relations pfr
              JOIN pokemon_flags pf ON pfr.flag_name = pf.name
              WHERE pfr.pokemon_stable_id = ? 
                AND pf.name IN ('Legendary', 'Mythical', 'UltraBeast', 'Paradox')
            `, [targetPokemonId]);

            const isRarePokemon = rarePokemonCheck.rows.length > 0;
            const itemName = isRarePokemon ? 'Brilliance Charm' : 'Shiny Charm';
            const itemNameKo = isRarePokemon ? '광휘의 부적' : '빛나는 부적';
            const cost = 1;

            const updateResult = await client.query(`
              UPDATE user_items ui
              JOIN items i ON ui.item_id = i.item_id
              SET ui.quantity = ui.quantity - ?, ui.updated_at = NOW()
              WHERE ui.user_id = ? 
                AND i.name = ? 
                AND ui.quantity >= ?
            `, [cost, userId, itemName, cost]);

            if (updateResult.affectedRows === 0) {
                throw new Error(`${itemNameKo}이 부족합니다...!`);
            }

            // 5. 이로치 지급
            await client.query(`
                INSERT INTO user_pokemon_collection (
                    user_id, pokemon_stable_id, is_shiny, obtained_reason, obtained_date
                ) VALUES (?, ?, true, 'Shiny Unlock', NOW())
            `, [userId, targetPokemonId]);

            logger.info('Shiny pokemon unlocked', { userId, targetPokemonId, cost, item: itemName });

            return createSuccessResponse({
                success: true,
                message: `...오잉!? ${pokemon.name}의 모습이...!`,
                targetPokemonId: targetPokemonId
            });
        });
    } catch (error) {
        logger.error('Error unlocking shiny pokemon', error);
        throw error;
    }
}

module.exports = { handler: withErrorHandling(handler) };
