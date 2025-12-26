const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');

/**
 * 포켓몬 컬렉션 관련 Lambda 함수
 * 
 * 지원하는 작업:
 * - GET /collection - 사용자 포켓몬 컬렉션 조회
 * - POST /favorite - 즐겨찾기 토글
 * - GET /favorites - 즐겨찾기 포켓몬 목록
 * - GET /icons - 포켓몬 아이콘 컬렉션
 * - GET /all-pokemon - 모든 보유 포켓몬 (세대별 정렬용)
 * - GET /evolution/{baseImageName} - 진화 트리 조회
 * - GET /evolution/{baseImageName} - 진화 트리 조회
 */

const handler = async (event, context) => {
  const db = getDatabase();
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path;
  const pathParameters = event.pathParameters || {};

  // [Fix] CloudFront origin_path adds stage prefix (e.g. /dev/api/...), so we need to strip it
  const stage = event.requestContext?.stage;
  let normalizedPath = path;
  if (stage && stage !== '$default' && path.startsWith(`/${stage}/`)) {
    normalizedPath = path.substring(stage.length + 1);
  }

  // Use normalizedPath for routing
  const routePath = normalizedPath;

  // 라우팅
  if (method === 'GET' && routePath.endsWith('/collection')) {
    return await getUserPokemonCollection(event, db);
  } else if (method === 'POST' && routePath.endsWith('/favorite')) {
    return await toggleFavoritePokemon(event, db);
  } else if (method === 'GET' && routePath.endsWith('/favorites')) {
    return await getFavoritePokemon(event, db);
  } else if (method === 'GET' && routePath.endsWith('/icons')) {
    return await getUserPokemonIcons(event, db);
  } else if (method === 'GET' && routePath.endsWith('/all-pokemon')) {
    return await getAllUserPokemon(event, db);
  } else if (method === 'GET' && routePath.includes('/evolution/')) {
    return await getEvolutionTree(event, db, pathParameters.baseImageName);


  } else if (method === 'GET' && routePath.endsWith('/starters')) {
    return await getStarterPokemon(event, db);
  } else if (method === 'GET' && routePath.includes('/pokemon/')) {
    const stableId = routePath.split('/pokemon/')[1];
    return await getPokemonData(event, db, stableId);
  } else {
    return createErrorResponse('Not Found', 404);
  }
};

/**
 * 사용자 포켓몬 컬렉션 조회
 */
async function getUserPokemonCollection(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};

  const includeShiny = queryParams.includeShiny !== 'false';
  const favoritesOnly = queryParams.favoritesOnly === 'true';
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const query = `
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'collection_id', upc.collection_id,
        'pokemon_stable_id', upc.pokemon_stable_id,
        'is_shiny', upc.is_shiny,
        'is_favorite', upc.is_favorite,
        'obtained_date', upc.obtained_date,
        'obtained_reason', upc.obtained_reason,
        'pokemon_name', p.name,
        'pokemon_type1', p.type1,
        'pokemon_type2', p.type2,
        'pokemon_category', p.category,
        'pokemon_generation', p.generation
      )
    ) as collection
    FROM user_pokemon_collection upc
    INNER JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
    WHERE upc.user_id = ?
      AND (? OR upc.is_shiny = false)
      AND (NOT ? OR upc.is_favorite = true)
    ORDER BY 
      upc.is_favorite DESC,  -- 즐겨찾기가 먼저
      upc.obtained_date DESC  -- 최근 획듍 순
  `;

  const result = await db.query(query, [userId, includeShiny, favoritesOnly]);
  return createSuccessResponse(result.rows[0]?.collection || []);
}

/**
 * 포켓몬 즐겨찾기 토글
 */
async function toggleFavoritePokemon(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { pokemonStableId, isShiny = false } = requestBody;

  if (!pokemonStableId) {
    return createErrorResponse('Pokemon stable ID is required', 400);
  }

  return await db.transaction(async (client) => {
    // 현재 즐겨찾기 상태 조회
    const currentResult = await client.query(`
      SELECT is_favorite 
      FROM user_pokemon_collection
      WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = ?
    `, [userId, pokemonStableId, isShiny]);

    if (currentResult.rows.length === 0) {
      throw new Error('Pokemon not found in user collection');
    }

    const currentFavorite = currentResult.rows[0].is_favorite;
    const newFavorite = !currentFavorite;

    // 즐겨찾기 상태 업데이트 (favorited_at도 함께 업데이트)
    await client.query(`
      UPDATE user_pokemon_collection
      SET is_favorite = ?,
          favorited_at = CASE WHEN ? THEN NOW() ELSE NULL END
      WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = ?
    `, [newFavorite, newFavorite, userId, pokemonStableId, isShiny]);

    logger.info('Pokemon favorite toggled', { userId, pokemonStableId, isShiny, isFavorite: newFavorite });

    return createSuccessResponse({
      pokemon_stable_id: pokemonStableId,
      is_shiny: isShiny,
      is_favorite: newFavorite,
      message: newFavorite ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기에서 제거되었습니다.'
    });
  });
}

/**
 * 즐겨찾기 포켓몬 목록 조회
 */
async function getFavoritePokemon(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const query = `
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'collection_id', upc.collection_id,
        'pokemon_stable_id', upc.pokemon_stable_id,
        'is_shiny', upc.is_shiny,
        'is_favorite', upc.is_favorite,
        'obtained_date', upc.obtained_date,
        'obtained_reason', upc.obtained_reason,
        'pokemon_name', p.name,
        'pokemon_type1', p.type1,
        'pokemon_type2', p.type2,
        'pokemon_category', p.category
      )
    ) as favorites
    FROM user_pokemon_collection upc
    INNER JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
    WHERE upc.user_id = ? AND upc.is_favorite = true
    ORDER BY upc.obtained_date DESC
  `;

  const result = await db.query(query, [userId]);
  return createSuccessResponse(result.rows[0]?.favorites || []);
}

/**
 * 사용자 포켓몬 아이콘 컬렉션 조회
 */
async function getUserPokemonIcons(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '') + '/';

  const query = `
    WITH RECURSIVE
    -- 1. Base 포켓몬(진화 그룹의 시작점)의 image_name들을 찾기
    base_pokemon_groups AS (
      SELECT 
        p.image_name,
        MIN(p.pokemon_id) AS base_pokemon_id
      FROM pokemon p
      JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
      JOIN pokemon_flags pf ON pfr.flag_name = pf.name
      WHERE pf.name IN ('Base', 'Legendary', 'Mythical', 'Paradox', 'UltraBeast')
      AND NOT EXISTS (
        SELECT 1 
        FROM pokemon_evolutions pe 
        JOIN pokemon p_target ON pe.to_pokemon = p_target.stable_id
        WHERE p_target.image_name = p.image_name
      )
      GROUP BY p.image_name
    ),
    -- 2. 각 그룹에 속한 모든 진화체들을 찾기 (재귀적 진화 체인)
    evolution_groups AS (
      SELECT 
        bp.image_name AS base_image_name,
        bp.base_pokemon_id,
        bp.image_name AS current_image_name,
        0 AS evolution_level
      FROM base_pokemon_groups bp
      
      UNION ALL
      
      SELECT 
        eg.base_image_name,
        eg.base_pokemon_id,
        pe.to_pokemon AS current_image_name,
        eg.evolution_level + 1
      FROM evolution_groups eg
      JOIN pokemon_evolutions pe ON pe.from_pokemon = eg.current_image_name
    ),
    -- 3. 각 그룹의 전체 포켓몬 목록 (진화체 + 모든 폼 변화)
    group_all_pokemon AS (
      SELECT 
        eg.base_image_name,
        eg.base_pokemon_id,
        p.stable_id,
        p.pokemon_id,
        p.image_name,
        p.form_suffix,
        p.asset_source,
        p.has_icon,
        p.has_icon_shiny,
        eg.evolution_level,
        -- 폼 번호 추출: _숫자 형태일 경우만 추출 (_female 등은 제외)
        CASE 
          WHEN p.form_suffix REGEXP '^_[0-9]+$'
          THEN CAST(SUBSTRING(p.form_suffix, 2) AS UNSIGNED)
          ELSE 0 
        END AS form_number
      FROM evolution_groups eg
      JOIN pokemon p ON p.image_name = eg.current_image_name
    ),
    -- 4. 사용자가 보유한 포켓몬 (일반 버전)
    user_owned_pokemon AS (
      SELECT 
        gap.base_image_name,
        gap.base_pokemon_id,
        gap.stable_id,
        gap.pokemon_id,
        gap.image_name,
        gap.form_suffix,
        gap.asset_source,
        gap.has_icon,
        gap.has_icon_shiny,
        gap.evolution_level,
        gap.form_number,
        upc.is_shiny,
        upc.is_favorite,
        upc.obtained_date,
        upc.favorited_at
      FROM group_all_pokemon gap
      JOIN user_pokemon_collection upc ON upc.pokemon_stable_id = gap.stable_id
      WHERE upc.user_id = ?
    ),
    -- 5. 각 그룹별 완성도 계산
    group_completion AS (
      SELECT 
        gap.base_image_name,
        MIN(gap.base_pokemon_id) AS base_pokemon_id,
        COUNT(DISTINCT gap.stable_id) AS total_count,
        COUNT(DISTINCT uop.stable_id) AS owned_count,
        -- 이로치 완성도 계산
        COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM user_pokemon_collection upc_shiny
            WHERE upc_shiny.user_id = ? 
              AND upc_shiny.pokemon_stable_id = gap.stable_id
              AND upc_shiny.is_shiny = true
          ) THEN gap.stable_id END
        ) AS shiny_owned_count,
        -- 이로치 완성 여부
        CASE WHEN COUNT(DISTINCT gap.stable_id) = COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM user_pokemon_collection upc_shiny
            WHERE upc_shiny.user_id = ? 
              AND upc_shiny.pokemon_stable_id = gap.stable_id
              AND upc_shiny.is_shiny = true
          ) THEN gap.stable_id END
        ) THEN 1 ELSE 0 END AS is_shiny_complete
      FROM group_all_pokemon gap
      LEFT JOIN user_owned_pokemon uop 
        ON gap.base_image_name = uop.base_image_name 
        AND gap.stable_id = uop.stable_id
      GROUP BY gap.base_image_name
    ),
    -- 6. 각 그룹별 대표 아이콘 선택 (최근 획득 순)
    ranked_icons AS (
      SELECT 
        uop.base_image_name,
        uop.base_pokemon_id,
        uop.pokemon_id,
        uop.stable_id AS display_stable_id,
        uop.image_name AS display_image_name,
        uop.asset_source AS display_asset_source,
        uop.has_icon AS display_has_icon,
        uop.has_icon_shiny AS display_has_icon_shiny,
        uop.form_suffix AS display_form_suffix,
        uop.is_favorite,
        uop.is_shiny,
        uop.favorited_at,
        uop.obtained_date,
        gc.owned_count,
        gc.total_count,
        gc.shiny_owned_count,
        gc.is_shiny_complete,
        ROW_NUMBER() OVER (
          PARTITION BY uop.base_image_name 
          ORDER BY 
            uop.obtained_date DESC,
            uop.evolution_level DESC, 
            uop.form_number DESC, 
            CASE WHEN uop.form_suffix IS NULL THEN 1 ELSE 0 END, -- NULLS LAST equivalent
            uop.form_suffix DESC,
            uop.stable_id
        ) as rn,
        MAX(uop.is_favorite) OVER (PARTITION BY uop.base_image_name) as group_has_favorite,
        COALESCE(p_base.asset_source, 'base') AS base_form_asset_source
      FROM user_owned_pokemon uop
      JOIN group_completion gc ON gc.base_image_name = uop.base_image_name
      LEFT JOIN pokemon p_base ON p_base.image_name = uop.image_name AND (p_base.form_suffix IS NULL OR p_base.form_suffix = '')
      WHERE gc.owned_count > 0
    ),
    representative_icons AS (
      SELECT * FROM ranked_icons 
      WHERE 
        (group_has_favorite = 1 AND is_favorite = 1)
        OR
        (group_has_favorite = 0 AND rn = 1)
    )
    -- 7. 최종 결과 생성 - JSON_ARRAYAGG 대신 여러 행 반환
    SELECT 
      ri.base_image_name,
      ri.display_stable_id,
      ri.display_image_name,
      ri.display_form_suffix,
      ri.is_shiny,
      CONCAT(?, 
        CASE 
          WHEN ri.is_shiny = 1 AND ri.display_has_icon_shiny = 1 THEN
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          WHEN ri.is_shiny = 1 AND ri.display_has_icon_shiny = 0 AND ri.display_has_icon = 1 AND ri.display_form_suffix IS NOT NULL THEN
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
          WHEN ri.is_shiny = 1 AND ri.display_has_icon_shiny = 0 AND ri.display_has_icon = 0 AND ri.display_form_suffix IS NOT NULL THEN
            CASE 
              WHEN ri.base_form_asset_source = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          WHEN ri.display_has_icon = 0 AND ri.display_form_suffix IS NOT NULL THEN
            CASE 
              WHEN ri.base_form_asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
          ELSE
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
        END,
        CASE 
          WHEN (ri.is_shiny = 1 AND ri.display_has_icon_shiny = 1 AND ri.display_form_suffix IS NOT NULL) 
               OR (ri.is_shiny = 0 AND ri.display_has_icon = 1 AND ri.display_form_suffix IS NOT NULL)
               OR (ri.is_shiny = 1 AND ri.display_has_icon_shiny = 0 AND ri.display_has_icon = 1 AND ri.display_form_suffix IS NOT NULL)
          THEN CONCAT(ri.display_image_name, ri.display_form_suffix, '.png')
          ELSE CONCAT(ri.display_image_name, '.png')
        END
      ) AS icon_url,
      CONCAT(?, 
        CASE 
          WHEN ri.display_has_icon_shiny = 1 THEN
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          WHEN ri.display_has_icon = 1 AND ri.display_form_suffix IS NOT NULL THEN
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
          WHEN ri.display_has_icon_shiny = 0 AND ri.display_has_icon = 0 AND ri.display_form_suffix IS NOT NULL THEN
            CASE 
              WHEN ri.base_form_asset_source = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          ELSE
            CASE 
              WHEN ri.display_asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
        END,
        CASE 
          WHEN ri.display_has_icon_shiny = 1 AND ri.display_form_suffix IS NOT NULL 
          THEN CONCAT(ri.display_image_name, ri.display_form_suffix, '.png')
          WHEN ri.display_has_icon_shiny = 0 AND ri.display_has_icon = 1 AND ri.display_form_suffix IS NOT NULL
          THEN CONCAT(ri.display_image_name, ri.display_form_suffix, '.png')
          ELSE CONCAT(ri.display_image_name, '.png')
        END
      ) AS icon_shiny_url,
      ri.is_favorite,
      ri.owned_count,
      ri.total_count,
      ROUND((CAST(ri.owned_count AS DECIMAL) / ri.total_count * 100), 1) AS completion_percentage,
      ri.owned_count = ri.total_count AS is_complete,
      ri.shiny_owned_count,
      ri.is_shiny_complete,
      ri.obtained_date
    FROM representative_icons ri
    ORDER BY 
      CASE WHEN ri.is_favorite THEN 0 ELSE 1 END,
      ri.favorited_at DESC,
      ri.base_pokemon_id, 
      ri.pokemon_id ASC
  `;

  // MySQL uses ? for parameters
  const result = await db.query(query, [userId, userId, userId, assetsBaseUrl, assetsBaseUrl]);

  // result.rows contains all the individual icon rows, already ordered by base_pokemon_id
  let icons = [];
  if (result.rows && result.rows.length > 0) {
    icons = result.rows;
  } else if (Array.isArray(result) && result.length > 0) {
    icons = result;
  }

  return createSuccessResponse(icons || []);
}

/**
 * 모든 보유 포켓몬 조회 (세대별 정렬용 - 모든 폼 펼쳐서 반환)
 * 각 포켓몬의 진화 체인 base 포켓몬 이름도 함께 반환
 */
async function getAllUserPokemon(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '') + '/';

  const query = `
    WITH RECURSIVE
    -- 1. Base 포켓몬 찾기
    base_pokemon AS (
      SELECT DISTINCT
        p.image_name,
        p.stable_id
      FROM pokemon p
      JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
      WHERE pfr.flag_name IN ('Base', 'Legendary', 'Mythical', 'Paradox', 'UltraBeast')
      AND NOT EXISTS (
        SELECT 1 
        FROM pokemon_evolutions pe 
        JOIN pokemon p_target ON pe.to_pokemon = p_target.stable_id
        WHERE p_target.image_name = p.image_name
      )
    ),
    -- 2. 진화 체인 구성 (base에서 시작해서 모든 진화체 매핑)
    evolution_chain AS (
      SELECT 
        bp.image_name AS base_image_name,
        bp.image_name AS current_image_name
      FROM base_pokemon bp
      
      UNION ALL
      
      SELECT 
        ec.base_image_name,
        pe.to_pokemon AS current_image_name
      FROM evolution_chain ec
      JOIN pokemon_evolutions pe ON pe.from_pokemon = ec.current_image_name
    ),
    -- 3. 각 image_name별 base_image_name 매핑
    image_to_base AS (
      SELECT DISTINCT
        current_image_name AS image_name,
        base_image_name
      FROM evolution_chain
    )
    SELECT 
      p.stable_id AS display_stable_id,
      COALESCE(itb.base_image_name, p.image_name) AS base_image_name,
      p.image_name AS display_image_name,
      p.form_suffix AS display_form_suffix,
      p.name,
      p.type1,
      p.type2,
      p.generation,
      p.pokemon_id,
      p.asset_source AS display_asset_source,
      p.has_icon AS display_has_icon,
      p.has_icon_shiny AS display_has_icon_shiny,
      upc.is_shiny,
      upc.is_favorite,
      upc.obtained_date,
      -- 아이콘 URL 생성 (샤이니지만 샤이니 아이콘이 없으면 일반 아이콘으로 폴백)
      CONCAT(?, 
        CASE 
          WHEN upc.is_shiny = 1 AND p.has_icon_shiny = 1 THEN
            CASE 
              WHEN p.asset_source = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          WHEN upc.is_shiny = 1 AND p.has_icon_shiny = 0 AND p.has_icon = 1 AND p.form_suffix IS NOT NULL THEN
            CASE 
              WHEN p.asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
          WHEN upc.is_shiny = 1 AND p.has_icon_shiny = 0 AND p.has_icon = 0 AND p.form_suffix IS NOT NULL THEN
            CASE 
              WHEN COALESCE(p_base.asset_source, 'base') = 'external' THEN 'external/img/Icons%20shiny/'
              ELSE 'base/img/Icons%20shiny/'
            END
          WHEN p.has_icon = 0 AND p.form_suffix IS NOT NULL THEN
            CASE 
              WHEN COALESCE(p_base.asset_source, 'base') = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
          ELSE
            CASE 
              WHEN p.asset_source = 'external' THEN 'external/img/Icons/'
              ELSE 'base/img/Icons/'
            END
        END,
        CASE 
          WHEN (upc.is_shiny = 1 AND p.has_icon_shiny = 1 AND p.form_suffix IS NOT NULL) 
               OR (upc.is_shiny = 0 AND p.has_icon = 1 AND p.form_suffix IS NOT NULL)
               OR (upc.is_shiny = 1 AND p.has_icon_shiny = 0 AND p.has_icon = 1 AND p.form_suffix IS NOT NULL)
          THEN CONCAT(p.image_name, p.form_suffix, '.png')
          ELSE CONCAT(p.image_name, '.png')
        END
      ) AS icon_url
    FROM user_pokemon_collection upc
    JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
    LEFT JOIN image_to_base itb ON p.image_name = itb.image_name
    LEFT JOIN pokemon p_base ON p_base.image_name = p.image_name AND (p_base.form_suffix IS NULL OR p_base.form_suffix = '')
    WHERE upc.user_id = ?
    ORDER BY 
      p.generation ASC,
      p.pokemon_id ASC
  `;

  const result = await db.query(query, [assetsBaseUrl, userId]);

  let pokemon = [];
  if (result.rows && result.rows.length > 0) {
    pokemon = result.rows;
  } else if (Array.isArray(result) && result.length > 0) {
    pokemon = result;
  }

  return createSuccessResponse(pokemon || []);
}

/**
 * 진화 트리 조회
 */
async function getEvolutionTree(event, db, baseImageName) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId || !baseImageName) {
    return createErrorResponse('User ID and base image name are required', 400);
  }

  const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '') + '/';

  const query = `
    WITH RECURSIVE
    -- 1. 진화 체인 구성 (재귀적으로 모든 진화체 찾기)
    evolution_chain AS (
      -- Base case: 시작 포켓몬
      SELECT 
        CAST(? AS CHAR(255)) COLLATE utf8mb4_unicode_ci AS image_name,
        0 AS evolution_level,
        CAST(NULL AS CHAR(255)) COLLATE utf8mb4_unicode_ci AS pre_evolution_stable_id
      
      UNION ALL
      
      -- Recursive case: 진화체들
      -- from_pokemon (stable_id)을 추적하여 정확한 진화 관계 유지
      SELECT
        p_to.image_name AS image_name,
        ec.evolution_level + 1,
        pe.from_pokemon AS pre_evolution_stable_id
      FROM evolution_chain ec
      JOIN pokemon p_from ON p_from.image_name = ec.image_name
      JOIN pokemon_evolutions pe ON pe.from_pokemon = p_from.stable_id
      JOIN pokemon p_to ON p_to.stable_id = pe.to_pokemon
    ),
    -- 2. 각 진화 레벨별 포켓몬과 폼들 (진화 관계 추적 포함)
    level_pokemon AS (
      SELECT DISTINCT
        ec.evolution_level,
        ec.image_name,
        -- 폼(suffix가 있는 경우)은 진화 관계를 끊음 (Form Unlock 대상이므로)
        -- pre_evolution_stable_id는 이제 실제 진화 전 포켓몬의 stable_id를 가리킴
        CASE 
          WHEN p.form_suffix IS NULL THEN ec.pre_evolution_stable_id 
          ELSE NULL 
        END AS pre_evolution_pokemon,
        p.pokemon_id,
        p.stable_id,
        p.name,
        p.form_suffix,
        p.type1,
        p.type2,
        p.asset_source,
        p.has_icon,
        p.has_icon_shiny,
        -- 사용자 보유 여부 (일반)
        EXISTS(
          SELECT 1 FROM user_pokemon_collection upc
          WHERE upc.user_id = ? 
            AND upc.pokemon_stable_id = p.stable_id
            AND upc.is_shiny = false
        ) AS is_owned,
        -- 사용자 보유 여부 (이로치)
        EXISTS(
          SELECT 1 FROM user_pokemon_collection upc
          WHERE upc.user_id = ? 
            AND upc.pokemon_stable_id = p.stable_id
            AND upc.is_shiny = true
        ) AS is_shiny_owned,
        (
          SELECT JSON_ARRAYAGG(pf.name)
          FROM pokemon_flag_relations pfr
          JOIN pokemon_flags pf ON pfr.flag_name = pf.name
          WHERE pfr.pokemon_stable_id = p.stable_id
        ) as flags,
        COALESCE(p_base.asset_source, 'base') AS base_form_asset_source
      FROM evolution_chain ec
      JOIN pokemon p ON p.image_name = ec.image_name
      LEFT JOIN pokemon p_base ON p_base.image_name = p.image_name AND (p_base.form_suffix IS NULL OR p_base.form_suffix = '')
    ),
    -- 3. 레벨별로 그룹핑하여 폼들을 배열로 묶기
    grouped_levels AS (
      SELECT 
        lp_outer.evolution_level,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'stable_id', lp.stable_id,
              'name', lp.name,
              'image_name', lp.image_name,
              'form_suffix', lp.form_suffix,
              'type1', lp.type1,
              'type2', lp.type2,
              'asset_source', lp.asset_source,
              'has_icon', lp.has_icon,
              'has_icon_shiny', lp.has_icon_shiny,
              'is_owned', lp.is_owned,
              'is_shiny_owned', lp.is_shiny_owned,
              'icon_url', CONCAT(?, 
                CASE 
                  WHEN lp.has_icon = 0 AND lp.form_suffix IS NOT NULL THEN
                    CASE 
                      WHEN lp.base_form_asset_source = 'external' THEN 'external/img/Icons/'
                      ELSE 'base/img/Icons/'
                    END
                  ELSE
                    CASE 
                      WHEN lp.asset_source = 'external' THEN 'external/img/Icons/'
                      ELSE 'base/img/Icons/'
                    END
                END,
                CASE 
                  WHEN lp.has_icon = 1 AND lp.form_suffix IS NOT NULL 
                  THEN CONCAT(lp.image_name, lp.form_suffix, '.png')
                  ELSE CONCAT(lp.image_name, '.png')
                END
              ),
              'icon_shiny_url', CONCAT(?, 
                CASE 
                  WHEN lp.has_icon_shiny = 1 THEN
                    CASE 
                      WHEN lp.asset_source = 'external' THEN 'external/img/Icons%20shiny/'
                      ELSE 'base/img/Icons%20shiny/'
                    END
                  WHEN lp.has_icon = 1 AND lp.form_suffix IS NOT NULL THEN
                    CASE 
                      WHEN lp.asset_source = 'external' THEN 'external/img/Icons/'
                      ELSE 'base/img/Icons/'
                    END
                  WHEN lp.has_icon_shiny = 0 AND lp.has_icon = 0 AND lp.form_suffix IS NOT NULL THEN
                    CASE 
                      WHEN lp.base_form_asset_source = 'external' THEN 'external/img/Icons%20shiny/'
                      ELSE 'base/img/Icons%20shiny/'
                    END
                  ELSE
                    CASE 
                      WHEN lp.asset_source = 'external' THEN 'external/img/Icons/'
                      ELSE 'base/img/Icons/'
                    END
                END,
                CASE 
                  WHEN lp.has_icon_shiny = 1 AND lp.form_suffix IS NOT NULL 
                  THEN CONCAT(lp.image_name, lp.form_suffix, '.png')
                  WHEN lp.has_icon_shiny = 0 AND lp.has_icon = 1 AND lp.form_suffix IS NOT NULL
                  THEN CONCAT(lp.image_name, lp.form_suffix, '.png')
                  ELSE CONCAT(lp.image_name, '.png')
                END
              ),
              'pre_evolution_pokemon', lp.pre_evolution_pokemon,
              'flags', lp.flags
            )
          )
          FROM (
            SELECT *
            FROM level_pokemon lp_inner
            WHERE lp_inner.evolution_level = lp_outer.evolution_level
            ORDER BY lp_inner.pokemon_id
          ) AS lp
        ) AS forms
      FROM (SELECT DISTINCT evolution_level FROM level_pokemon) lp_outer
    ),
    -- 4. 완성도 계산
    completion_stats AS (
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN is_owned THEN 1 ELSE 0 END) AS owned_count,
        SUM(CASE WHEN is_shiny_owned THEN 1 ELSE 0 END) AS shiny_owned_count
      FROM level_pokemon
    )
    -- 5. 최종 결과 생성
    SELECT JSON_OBJECT(
      'evolution_tree', JSON_OBJECT(
        'root', ?,
        'levels', (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'level', evolution_level,
              'base_pokemon', NULL,
              'pre_evolution_pokemon', NULL,
              'forms', forms
            )
          )
          FROM grouped_levels
          ORDER BY evolution_level
        )
      ),
      'completion', (
        SELECT JSON_OBJECT(
          'total_count', total_count,
          'owned_count', owned_count,
          'shiny_owned_count', shiny_owned_count,
          'completion_percentage', ROUND(
            CASE WHEN total_count > 0 
            THEN (CAST(owned_count AS DECIMAL) / total_count * 100) 
            ELSE 0 
            END, 
            1
          ),
          'is_complete', owned_count = total_count,
          'is_shiny_complete', shiny_owned_count = total_count
        )
        FROM completion_stats
      )
    ) AS evolution_tree
  `;

  const result = await db.query(query, [baseImageName, userId, userId, assetsBaseUrl, assetsBaseUrl, baseImageName]);
  return createSuccessResponse(result.rows[0]?.evolution_tree || {});
}


/**
 * 포켓몬 상세 데이터 조회
 */
async function getPokemonData(event, db, stableId) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;
  const isShiny = queryParams.isShiny === 'true' || queryParams.isShiny === '1';

  if (!stableId) {
    return createErrorResponse('Pokemon stable ID is required', 400);
  }

  const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '/pokehabit-assets').replace(/\/$/, '') + '/';

  const query = `
    SELECT 
      p.*,
      p.has_cry,
      -- Construct base URL path
      CASE 
        WHEN p.asset_source = 'external' THEN 'external/img/'
        ELSE 'base/img/'
      END as url_path,
      (
        SELECT JSON_ARRAYAGG(pf.name)
        FROM pokemon_flag_relations pfr
        JOIN pokemon_flags pf ON pfr.flag_name = pf.name
        WHERE pfr.pokemon_stable_id = p.stable_id
      ) as flags
    FROM pokemon p
    WHERE p.stable_id = ?
  `;

  const result = await db.query(query, [stableId]);

  if (result.rows.length === 0) {
    return createSuccessResponse(null);
  }

  const pokemon = result.rows[0];
  const baseUrl = `${assetsBaseUrl}${pokemon.url_path}`;
  const imageName = pokemon.image_name;
  const suffix = pokemon.form_suffix || '';
  const fileName = `${imageName}${suffix}.png`;

  // Determine background based on habitat and type
  const habitat = pokemon.habitat_en ? pokemon.habitat_en.toLowerCase().replace(/\s+/g, '_') : 'unknown';
  const type1 = pokemon.type1_en ? pokemon.type1_en.toLowerCase() : 'normal';
  const type2 = pokemon.type2_en ? pokemon.type2_en.toLowerCase() : null;

  // Base URL for custom backgrounds
  const customBgBaseUrl = `${assetsBaseUrl}custom/img/background`;

  // Determine primary type for background
  // If one of the types is 'normal' and there is another type, prioritize the other type
  let primaryType = type1;
  let secondaryType = type2;

  if (type1 === 'normal' && type2) {
    primaryType = type2;
    secondaryType = type1;
  }

  // 1. Habitat + Primary Type
  const backgroundUrl = `${customBgBaseUrl}/${habitat}/${primaryType}.png`;

  // Fallbacks
  const fallbackBackgrounds = [];

  // 2. Habitat + Secondary Type (if exists)
  if (secondaryType) {
    fallbackBackgrounds.push(`${customBgBaseUrl}/${habitat}/${secondaryType}.png`);
  }

  // 3. Habitat + Normal (Habitat-specific fallback)
  fallbackBackgrounds.push(`${customBgBaseUrl}/${habitat}/normal.png`);

  // Determine image folders based on shiny status and asset availability
  // If shiny but no shiny asset exists, fall back to normal asset
  const useShinyFront = isShiny && pokemon.has_front_shiny;
  const useShinyBack = isShiny && pokemon.has_back_shiny;
  const frontFolder = useShinyFront ? 'Front%20shiny' : 'Front';
  const backFolder = useShinyBack ? 'Back%20shiny' : 'Back';

  // Check User Status (Owned, Favorite)
  let isOwned = false;
  let isFavorite = false;

  if (userId) {
    const userStatus = await db.query(`
      SELECT is_favorite 
      FROM user_pokemon_collection 
      WHERE user_id = ? 
        AND pokemon_stable_id = ? 
        AND is_shiny = ?
    `, [userId, stableId, isShiny]);

    if (userStatus.rows.length > 0) {
      isOwned = true;
      isFavorite = !!userStatus.rows[0].is_favorite;
    }

    // Check if user owns shiny version (regardless of current isShiny param)
    const shinyStatus = await db.query(`
      SELECT 1 FROM user_pokemon_collection
      WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = true
    `, [userId, stableId]);

    if (shinyStatus.rows.length > 0) {
      // If we are already checking shiny (isShiny=true), this is redundant but safe
      // If we are checking normal (isShiny=false), this tells us if shiny exists
    }
    var hasShiny = shinyStatus.rows.length > 0;
  } else {
    var hasShiny = false;
  }

  const responseData = {
    pokemon: pokemon,
    front_image: (useShinyFront ? true : pokemon.has_front) ? `${baseUrl}${frontFolder}/${fileName}` : null,
    back_image: (useShinyBack ? true : pokemon.has_back) ? `${baseUrl}${backFolder}/${fileName}` : null,
    background_image: backgroundUrl,
    fallback_backgrounds: fallbackBackgrounds,
    cry_sound: `${assetsBaseUrl}base/sound/Cries/${pokemon.has_cry ? pokemon.stable_id : imageName}.ogg`,
    is_shiny: isShiny,
    has_shiny: hasShiny,
    is_owned: isOwned,
    is_favorite: isFavorite
  };

  return createSuccessResponse(responseData);
}

/**
 * 스타터 포켓몬 목록 조회
 * Base 플래그를 가진 포켓몬들을 반환
 */
async function getStarterPokemon(event, db) {
  const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '/pokehabit-assets').replace(/\/$/, '') + '/';

  const query = `
    SELECT 
      p.stable_id,
      p.name,
      p.type1,
      p.type2,
      p.type1_en,
      p.type2_en,
      p.image_name,
      p.form_suffix,
      p.asset_source,
      p.has_front,
      CONCAT(?, 
        CASE 
          WHEN p.asset_source = 'external' THEN 'external/img/Front/'
          ELSE 'base/img/Front/'
        END,
        CASE 
          WHEN p.form_suffix IS NOT NULL 
          THEN CONCAT(p.image_name, p.form_suffix, '.png')
          ELSE CONCAT(p.image_name, '.png')
        END
      ) AS front_image
    FROM pokemon p
    JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
    WHERE pfr.flag_name = 'Base'
    ORDER BY p.pokemon_id
  `;

  const result = await db.query(query, [assetsBaseUrl]);
  return createSuccessResponse(result.rows || result);
}

module.exports = { handler: withErrorHandling(handler) };