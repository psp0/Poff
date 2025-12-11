/**
 * Guest Mode API - 게스트 모드용 데이터 제공
 * 
 * DB에 미리 생성된 게스트 유저(00000000-0000-0000-0000-000000000000)의 
 * 실제 데이터를 조회하여 제공합니다.
 */

const { success, notFound, internalServerError } = require('../../shared/response');
const db = require('../../shared/database');
const { logger } = require('../../shared/logger');

// 게스트 유저 ID (고정)
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';

// 환경 변수에서 에셋 기본 URL 가져오기 (기본값: /assets)
// Remove trailing slash if present to avoid double slashes
const ASSETS_BASE_URL = (process.env.ASSETS_BASE_URL || '/assets').replace(/\/$/, '');

/**
 * 에셋 URL 빌더 - 폴더명에 공백이 있는 경우 인코딩 처리
 */
function buildAssetUrl(category, folder, filename) {
  const encodedFolder = folder.split('/').map(part => encodeURIComponent(part)).join('/');
  const encodedFilename = encodeURIComponent(filename);
  return `${ASSETS_BASE_URL}/${category}/${encodedFolder}/${encodedFilename}`;
}

/**
 * 게스트 유저의 포켓몬 컬렉션 아이콘 목록 조회
 */
async function getGuestPokemonIcons() {
  const query = `
    SELECT 
      p.image_name as base_image_name,
      p.stable_id as display_stable_id,
      MAX(upc.is_shiny) as is_shiny,
      p.generation,
      p.has_icon,
      p.has_icon_shiny,
      p.asset_source
    FROM user_pokemon_collection upc
    JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
    WHERE upc.user_id = ?
    GROUP BY p.image_name, p.stable_id, p.generation, p.has_icon, p.has_icon_shiny, p.asset_source
    ORDER BY p.generation, p.image_name
  `;

  const result = await db.query(query, [GUEST_USER_ID]);
  const rows = result.rows;

  return rows.map(row => {
    const isShiny = row.is_shiny === 1;
    const hasShinyIcon = row.has_icon_shiny === 1;
    // 샤이니지만 샤이니 아이콘이 없으면 일반 아이콘 폴더로 폴백
    const iconFolder = (isShiny && hasShinyIcon) ? 'img/Icons shiny' : 'img/Icons';
    const assetSource = row.asset_source || 'base';

    return {
      base_image_name: row.base_image_name,
      display_stable_id: row.display_stable_id,
      is_shiny: isShiny,
      generation: row.generation,
      icon_url: buildAssetUrl(assetSource, iconFolder, `${row.base_image_name}.png`)
    };
  });
}

/**
 * 게스트 유저의 포켓몬 상세 정보 조회
 */
async function getGuestPokemonDetail(stableId, isShiny) {
  // 먼저 게스트 유저가 해당 포켓몬을 보유하고 있는지 확인
  const collectionQuery = `
    SELECT upc.*, p.*
    FROM user_pokemon_collection upc
    JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
    WHERE upc.user_id = ? AND p.stable_id = ?
    LIMIT 1
  `;

  const collectionResult = await db.query(collectionQuery, [GUEST_USER_ID, stableId]);
  const rows = collectionResult.rows;

  if (rows.length === 0) {
    // 보유하지 않은 포켓몬이면 기본 정보만 반환
    const pokemonQuery = `SELECT * FROM pokemon WHERE stable_id = ? LIMIT 1`;
    const pokemonResult = await db.query(pokemonQuery, [stableId]);
    const pokemonRows = pokemonResult.rows;

    if (pokemonRows.length === 0) {
      return null;
    }

    const p = pokemonRows[0];
    return buildPokemonResponse(p, false, isShiny, false);
  }

  const row = rows[0];
  const hasShiny = row.has_icon_shiny || row.has_front_shiny;

  return buildPokemonResponse(row, row.is_favorite, isShiny && hasShiny, hasShiny);
}

/**
 * 포켓몬 응답 데이터 생성
 */
function buildPokemonResponse(p, isFavorite, isShiny, hasShiny) {
  const assetSource = p.asset_source || 'base';
  const frontFolder = isShiny ? 'img/Front shiny' : 'img/Front';
  const backFolder = isShiny ? 'img/Back shiny' : 'img/Back';

  // 파일 확장자는 항상 png (has_front/has_back은 이미지 존재 여부만 나타냄)
  const frontExt = 'png';
  const backExt = 'png';

  // 배경 이미지 로직 (로그인 모드와 동일)
  const habitat = p.habitat_en ? p.habitat_en.toLowerCase().replace(/\s+/g, '_') : 'unknown';
  const type1 = p.type1_en ? p.type1_en.toLowerCase() : 'normal';
  const type2 = p.type2_en ? p.type2_en.toLowerCase() : null;

  // Determine primary type for background
  // If one of the types is 'normal' and there is another type, prioritize the other type
  let primaryType = type1;
  let secondaryType = type2;

  if (type1 === 'normal' && type2) {
    primaryType = type2;
    secondaryType = type1;
  }

  // Background URL: custom/img/background/{habitat}/{type}.png
  const backgroundUrl = p.habitat_en ? buildAssetUrl('custom', `img/background/${habitat}`, `${primaryType}.png`) : null;

  // Fallback backgrounds
  const fallbackBackgrounds = [];
  if (secondaryType) {
    fallbackBackgrounds.push(buildAssetUrl('custom', `img/background/${habitat}`, `${secondaryType}.png`));
  }
  fallbackBackgrounds.push(buildAssetUrl('custom', `img/background/${habitat}`, 'normal.png'));

  return {
    pokemon: {
      name: p.name,
      pokedex: p.pokedex,
      category: p.category,
      habitat: p.habitat,
      habitat_en: p.habitat_en,
      type1: p.type1,
      type2: p.type2,
      type1_en: p.type1_en,
      type2_en: p.type2_en,
      front_animation_speed: p.front_animation_speed || 2,
      back_animation_speed: p.back_animation_speed || 2,
      generation: p.generation,
      base_stat_total: p.base_stat_total
    },
    is_favorite: isFavorite,
    is_shiny: isShiny,
    has_shiny: hasShiny,
    front_image: buildAssetUrl(assetSource, frontFolder, `${p.image_name}.${frontExt}`),
    back_image: buildAssetUrl(assetSource, backFolder, `${p.image_name}.${backExt}`),
    cry_sound: buildAssetUrl('base', 'sound/Cries', `${p.image_name}.ogg`),
    background_image: backgroundUrl,
    fallback_backgrounds: fallbackBackgrounds
  };
}

/**
 * 게스트 유저의 진화 트리 조회
 */
async function getGuestEvolutionTree(baseImageName) {
  // 1. 해당 이미지 이름의 모든 관련 포켓몬 찾기 (진화 체인)
  // 먼저 기본 포켓몬의 진화 체인을 찾기 위해 역추적 및 순추적

  // 진화 전 포켓몬 찾기 (역추적)
  const findRootQuery = `
    WITH RECURSIVE evo_back AS (
      SELECT from_pokemon, to_pokemon, 1 as depth
      FROM pokemon_evolutions
      WHERE to_pokemon = ?
      
      UNION ALL
      
      SELECT pe.from_pokemon, pe.to_pokemon, eb.depth + 1
      FROM pokemon_evolutions pe
      JOIN evo_back eb ON pe.to_pokemon = eb.from_pokemon
      WHERE eb.depth < 5
    )
    SELECT from_pokemon FROM evo_back ORDER BY depth DESC LIMIT 1
  `;

  const rootQueryResult = await db.query(findRootQuery, [baseImageName]);
  const rootResult = rootQueryResult.rows;
  const rootImageName = rootResult.length > 0 ? rootResult[0].from_pokemon : baseImageName;

  // 2. 루트에서 시작하여 전체 진화 체인 조회
  const evolutionQuery = `
    WITH RECURSIVE evo_chain AS (
      -- 루트 포켓몬
      SELECT image_name, 0 as level
      FROM pokemon
      WHERE image_name = ? AND (form_suffix IS NULL OR form_suffix = '')
      
      UNION ALL
      
      -- 진화 포켓몬들
      SELECT pe.to_pokemon, ec.level + 1
      FROM pokemon_evolutions pe
      JOIN evo_chain ec ON pe.from_pokemon = ec.image_name
      WHERE ec.level < 5
    )
    SELECT DISTINCT 
      p.stable_id,
      p.image_name,
      p.name,
      p.form_suffix,
      p.type1,
      p.type2,
      p.has_icon,
      p.has_icon_shiny,
      p.asset_source,
      (
        SELECT JSON_ARRAYAGG(pf.name)
        FROM pokemon_flag_relations pfr
        JOIN pokemon_flags pf ON pfr.flag_name = pf.name
        WHERE pfr.pokemon_stable_id = p.stable_id
      ) as flags,
      ec.level,
      upc.collection_id IS NOT NULL as is_owned,
      COALESCE(upc.is_shiny, 0) as is_shiny,
      pe_pre.from_pokemon as pre_evolution_pokemon,
      COALESCE(p_base.asset_source, 'base') as base_asset_source
    FROM evo_chain ec
    JOIN pokemon p ON p.image_name = ec.image_name
    LEFT JOIN user_pokemon_collection upc ON p.stable_id = upc.pokemon_stable_id AND upc.user_id = ?
    LEFT JOIN pokemon_evolutions pe_pre ON p.image_name = pe_pre.to_pokemon
    LEFT JOIN pokemon p_base ON p_base.image_name = p.image_name AND (p_base.form_suffix IS NULL OR p_base.form_suffix = '')
    ORDER BY ec.level, ISNULL(p.form_suffix) DESC, p.form_suffix
  `;

  const evolutionResult = await db.query(evolutionQuery, [rootImageName, GUEST_USER_ID]);
  const rows = evolutionResult.rows;

  if (rows.length === 0) {
    // 진화 체인이 없으면 단일 포켓몬만 반환
    const singleQuery = `
      SELECT p.*, 
        upc.collection_id IS NOT NULL as is_owned, 
        COALESCE(upc.is_shiny, 0) as is_shiny,
        (
          SELECT JSON_ARRAYAGG(pf.name)
          FROM pokemon_flag_relations pfr
          JOIN pokemon_flags pf ON pfr.flag_name = pf.name
          WHERE pfr.pokemon_stable_id = p.stable_id
        ) as flags,
        COALESCE(p_base.asset_source, 'base') as base_asset_source
      FROM pokemon p
      LEFT JOIN user_pokemon_collection upc ON p.stable_id = upc.pokemon_stable_id AND upc.user_id = ?
      LEFT JOIN pokemon p_base ON p_base.image_name = p.image_name AND (p_base.form_suffix IS NULL OR p_base.form_suffix = '')
      WHERE p.image_name = ?
    `;
    const singleResult = await db.query(singleQuery, [GUEST_USER_ID, baseImageName]);
    const singleRows = singleResult.rows;

    if (singleRows.length === 0) {
      return null;
    }

    const ownedCount = singleRows.filter(r => r.is_owned).length;
    const assetSource = singleRows[0]?.asset_source || 'base';

    return {
      evolution_tree: {
        levels: [{
          forms: singleRows.map(row => {
            const rowAssetSource = row.asset_source || 'base';
            const baseAssetSource = row.base_asset_source || 'base';
            const iconFile = row.form_suffix ? `${row.image_name}${row.form_suffix}.png` : `${row.image_name}.png`;

            // Determine displayed icon URL
            let displayUrl;
            if (row.is_shiny) {
              if (row.has_icon_shiny) {
                displayUrl = buildAssetUrl(rowAssetSource, 'img/Icons shiny', iconFile);
              } else if (row.has_icon && row.form_suffix) {
                displayUrl = buildAssetUrl(rowAssetSource, 'img/Icons', iconFile);
              } else {
                displayUrl = buildAssetUrl(baseAssetSource, 'img/Icons shiny', `${row.image_name}.png`);
              }
            } else {
              if (row.has_icon) {
                displayUrl = buildAssetUrl(rowAssetSource, 'img/Icons', iconFile);
              } else if (row.form_suffix) {
                displayUrl = buildAssetUrl(baseAssetSource, 'img/Icons', `${row.image_name}.png`);
              } else {
                displayUrl = buildAssetUrl(rowAssetSource, 'img/Icons', iconFile);
              }
            }

            // Determine shiny icon URL (for switching)
            let shinyUrl;
            if (row.has_icon_shiny) {
              shinyUrl = buildAssetUrl(rowAssetSource, 'img/Icons shiny', iconFile);
            } else if (row.has_icon && row.form_suffix) {
              shinyUrl = buildAssetUrl(rowAssetSource, 'img/Icons', iconFile);
            } else {
              shinyUrl = buildAssetUrl(baseAssetSource, 'img/Icons shiny', `${row.image_name}.png`);
            }

            return {
              stable_id: row.stable_id,
              name: row.name,
              type1: row.type1,
              type2: row.type2,
              flags: row.flags ? (typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags) : null,
              has_icon: row.has_icon,
              icon_url: displayUrl,
              is_owned: row.is_owned === 1,
              is_shiny_owned: row.is_shiny === 1,
              image_name: row.image_name,
              form_suffix: row.form_suffix || null,
              asset_source: rowAssetSource,
              has_icon_shiny: row.has_icon_shiny,
              icon_shiny_url: shinyUrl,
              pre_evolution_pokemon: null
            };
          })
        }]
      },
      completion: {
        completion_percentage: singleRows.length > 0 ? Math.round((ownedCount / singleRows.length) * 100) : 0,
        is_complete: ownedCount === singleRows.length
      }
    };
  }

  // 3. 레벨별로 그룹화
  const levelMap = new Map();
  let ownedCount = 0;

  for (const row of rows) {
    const level = row.level;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }

    const isShiny = row.is_shiny === 1;
    const isOwned = row.is_owned === 1;
    if (isOwned) ownedCount++;

    const assetSource = row.asset_source || 'base';
    const baseAssetSource = row.base_asset_source || 'base';
    const iconFile = row.form_suffix ? `${row.image_name}${row.form_suffix}.png` : `${row.image_name}.png`;

    // Determine displayed icon URL
    let displayUrl;
    if (isShiny) {
      if (row.has_icon_shiny) {
        displayUrl = buildAssetUrl(assetSource, 'img/Icons shiny', iconFile);
      } else if (row.has_icon && row.form_suffix) {
        displayUrl = buildAssetUrl(assetSource, 'img/Icons', iconFile);
      } else {
        displayUrl = buildAssetUrl(baseAssetSource, 'img/Icons shiny', `${row.image_name}.png`);
      }
    } else {
      if (row.has_icon) {
        displayUrl = buildAssetUrl(assetSource, 'img/Icons', iconFile);
      } else if (row.form_suffix) {
        displayUrl = buildAssetUrl(baseAssetSource, 'img/Icons', `${row.image_name}.png`);
      } else {
        displayUrl = buildAssetUrl(assetSource, 'img/Icons', iconFile);
      }
    }

    // Determine shiny icon URL (for switching)
    let shinyUrl;
    if (row.has_icon_shiny) {
      shinyUrl = buildAssetUrl(assetSource, 'img/Icons shiny', iconFile);
    } else if (row.has_icon && row.form_suffix) {
      shinyUrl = buildAssetUrl(assetSource, 'img/Icons', iconFile);
    } else {
      shinyUrl = buildAssetUrl(baseAssetSource, 'img/Icons shiny', `${row.image_name}.png`);
    }

    // Parse flags if it's a JSON string
    let flags = null;
    if (row.flags) {
      try {
        flags = typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags;
      } catch (e) {
        flags = null;
      }
    }

    levelMap.get(level).push({
      stable_id: row.stable_id,
      name: row.name,
      type1: row.type1,
      type2: row.type2,
      flags: flags,
      has_icon: row.has_icon,
      icon_url: displayUrl,
      is_owned: isOwned,
      is_shiny_owned: isShiny,
      image_name: row.image_name,
      form_suffix: row.form_suffix || null,
      asset_source: assetSource,
      has_icon_shiny: row.has_icon_shiny,
      icon_shiny_url: shinyUrl,
      pre_evolution_pokemon: row.pre_evolution_pokemon || null
    });
  }

  // 4. 레벨 배열로 변환
  const levels = [];
  const maxLevel = Math.max(...levelMap.keys());
  for (let i = 0; i <= maxLevel; i++) {
    if (levelMap.has(i)) {
      levels.push({ forms: levelMap.get(i) });
    }
  }

  const totalCount = rows.length;
  const completionPercentage = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  return {
    evolution_tree: { levels },
    completion: {
      completion_percentage: completionPercentage,
      is_complete: ownedCount === totalCount
    }
  };
}

/**
 * 게스트 유저의 운동 목록 (고정값 - 읽기 전용)
 */
function getGuestExercises() {
  // DB 조회 대신 고정값 반환 (다른 사용자에게 영향 없음)
  return [
    { id: 'guest-ex-1', exercise_name: '벤치프레스 (체험용)', weight_kg: 60, intensity_type: 'reps', reps: 10, muscle_group_id: 'chest', muscle_group_name: '가슴' },
    { id: 'guest-ex-2', exercise_name: '데드리프트 (체험용)', weight_kg: 100, intensity_type: 'reps', reps: 5, muscle_group_id: 'back', muscle_group_name: '등' },
    { id: 'guest-ex-3', exercise_name: '스쿼트 (체험용)', weight_kg: 80, intensity_type: 'reps', reps: 8, muscle_group_id: 'quad', muscle_group_name: '대퇴사두근' }
  ];
}

/**
 * 게스트 유저의 주간 운동 통계 (고정값 - 읽기 전용)
 */
function getGuestWeeklyStats() {
  // DB 조회 대신 고정값 반환 (다른 사용자에게 영향 없음)
  // 실제 API 응답과 동일한 필드 구조 사용
  return {
    muscleGroups: [
      {
        muscle_group_id: 'chest',
        muscle_group_name: 'chest',
        muscle_group_name_ko: '가슴',
        total_sets: 10,
        mv_sets: 0,
        mev_sets: 6,
        mav_min_sets: 10,
        mav_max_sets: 14,
        mrv_sets: 20
      },
      {
        muscle_group_id: 'back',
        muscle_group_name: 'back',
        muscle_group_name_ko: '등',
        total_sets: 8,
        mv_sets: 0,
        mev_sets: 8,
        mav_min_sets: 12,
        mav_max_sets: 18,
        mrv_sets: 25
      },
      {
        muscle_group_id: 'quad',
        muscle_group_name: 'quad',
        muscle_group_name_ko: '대퇴사두근',
        total_sets: 15,
        mv_sets: 0,
        mev_sets: 6,
        mav_min_sets: 10,
        mav_max_sets: 14,
        mrv_sets: 20
      }
    ]
  };
}

/**
 * 게스트 유저의 아이템 목록 (고정값 - 읽기 전용)
 */
function getGuestItems() {
  // DB 조회 대신 고정값 반환 (다른 사용자에게 영향 없음)
  return [
    { name: 'Oval Charm', name_ko: '둥근부적', quantity: 5 },
    { name: 'Rare Candy', name_ko: '이상한 사탕', quantity: 3 },
    { name: 'Shiny Charm', name_ko: '빛나는 부적', quantity: 1 }
  ];
}

/**
 * 스타터 포켓몬 목록 (로그인 화면용)
 */
async function getStarterPokemon() {
  const query = `
    SELECT stable_id, name, type1, type2, generation, image_name, asset_source, has_front
    FROM pokemon
    WHERE image_name IN ('EEVEE', 'PICHU', 'DRATINI', 'RALTS', 'GIRATINA', 'DEERLING', 'FROAKIE', 'ZERAORA', 'KUBFU', 'SPRIGATITO')
      AND (form_suffix IS NULL OR form_suffix = '')
    ORDER BY generation
  `;

  const result = await db.query(query);
  const rows = result.rows;

  return rows.map(row => {
    // All front images are PNG files (has_front just indicates if the image exists)
    return {
      id: row.stable_id,
      name: row.name,
      type1: row.type1,
      type2: row.type2,
      generation: row.generation,
      front_image: buildAssetUrl(row.asset_source || 'base', 'img/Front', `${row.image_name}.png`)
    };
  });
}

exports.handler = async (event, context) => {
  const { httpMethod, path, pathParameters, queryStringParameters } = event;

  try {
    // /api/guest/icons - 포켓몬 아이콘 목록
    if (path === '/api/guest/icons' && httpMethod === 'GET') {
      const icons = await getGuestPokemonIcons();
      return success(icons);
    }

    // /api/guest/all-pokemon - 전체 포켓몬 (세대별 정렬)
    if (path === '/api/guest/all-pokemon' && httpMethod === 'GET') {
      const icons = await getGuestPokemonIcons();
      return success(icons);
    }

    // /api/guest/pokemon/:stableId - 포켓몬 상세 정보
    if (path.startsWith('/api/guest/pokemon/') && httpMethod === 'GET') {
      const stableId = pathParameters?.stableId || path.split('/').pop();
      const isShiny = queryStringParameters?.isShiny === 'true';

      const pokemonData = await getGuestPokemonDetail(stableId, isShiny);
      if (!pokemonData) {
        return notFound('Pokemon not found');
      }
      return success(pokemonData);
    }

    // /api/guest/evolution/:baseImageName - 진화 트리
    if (path.startsWith('/api/guest/evolution/') && httpMethod === 'GET') {
      const baseImageName = pathParameters?.baseImageName || path.split('/').pop();

      const evolutionData = await getGuestEvolutionTree(baseImageName);
      if (!evolutionData) {
        return notFound('Evolution tree not found');
      }
      return success(evolutionData);
    }

    // /api/guest/exercises - 운동 목록
    if (path === '/api/guest/exercises' && httpMethod === 'GET') {
      const exercises = getGuestExercises();
      return success(exercises);
    }

    // /api/guest/muscle-groups - 근육 그룹 목록 (공개 데이터)
    if (path === '/api/guest/muscle-groups' && httpMethod === 'GET') {
      const groupsResult = await db.query(`
        SELECT id, name, name_ko, mev_sets, mav_min_sets as mav_sets
        FROM muscle_groups
        ORDER BY name_ko
      `);
      return success(groupsResult.rows);
    }

    // /api/guest/weekly-stats - 주간 통계
    if (path === '/api/guest/weekly-stats' && httpMethod === 'GET') {
      const stats = getGuestWeeklyStats();
      return success(stats);
    }

    // /api/guest/eggs - 알 목록 (빈 목록)
    if (path === '/api/guest/eggs' && httpMethod === 'GET') {
      return success([]);
    }

    // /api/guest/sessions - 운동 세션 (빈 목록)
    if (path === '/api/guest/sessions' && httpMethod === 'GET') {
      return success([]);
    }

    // /api/guest/starter-pokemon - 스타터 포켓몬 목록 (로그인 화면용)
    if (path === '/api/guest/starter-pokemon' && httpMethod === 'GET') {
      const starters = await getStarterPokemon();
      return success(starters);
    }

    // /api/guest/items - 게스트 유저 아이템 (고정값)
    if (path === '/api/guest/items' && httpMethod === 'GET') {
      const items = getGuestItems();
      return success(items);
    }

    return notFound('Not found');

  } catch (err) {
    logger.error('Guest mode error:', err);
    return internalServerError('Internal server error: ' + err.message);
  }
};
