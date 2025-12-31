const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');

/**
 * 알 시스템 관련 Lambda 함수
 * 
 * 지원하는 작업:
 * - GET /eggs - 사용자 알(부화기) 목록 조회
 * - GET /eggs/search - 알 탐색 (포켓몬 검색)
 * - POST /eggs/acquire - 알 획득 (둥근부적 사용)
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

  if (method === 'GET' && routePath.endsWith('/eggs')) {
    return await getUserEggs(event, db);
  } else if (method === 'GET' && routePath.endsWith('/eggs/search')) {
    return await searchPokemonEggs(event, db);
  } else if (method === 'POST' && routePath.endsWith('/eggs/acquire')) {
    return await acquireEgg(event, db);
  } else if (method === 'POST' && routePath.endsWith('/eggs/hatch')) {
    return await hatchEgg(event, db);
  } else {
    return createErrorResponse('Not Found', 404);
  }
};

/**
 * 사용자 알 목록 조회
 */
async function getUserEggs(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  // 알 목록과 둥근부적 개수 함께 조회
  const query = `
    SELECT 
      (SELECT COALESCE(JSON_ARRAYAGG(
        JSON_OBJECT(
          'egg_id', ue.egg_id,
          'pokemon_stable_id', ue.pokemon_stable_id,
          'pokemon_name', p.name,
          'slot_index', ue.slot_index,
          'obtained_at', ue.obtained_at,
          'hatch_at', ue.hatch_at,
          'is_hatched', ue.is_hatched,
          'remaining_seconds', TIMESTAMPDIFF(SECOND, NOW(), ue.hatch_at)
        )
      ), CAST('[]' AS JSON)) FROM user_eggs ue 
      JOIN pokemon p ON ue.pokemon_stable_id = p.stable_id
      WHERE ue.user_id = ?
      ORDER BY ue.slot_index) as eggs,
      
      (SELECT ui.quantity FROM user_items ui
       JOIN items i ON ui.item_id = i.item_id
       WHERE ui.user_id = ? AND i.name = 'Oval Charm') as round_charms
  `;

  const result = await db.query(query, [userId, userId]);
  const data = result.rows[0] || { eggs: [], round_charms: 0 };

  return createSuccessResponse({
    eggs: data.eggs || [],
    round_charms: data.round_charms || 0
  });
}

/**
 * 알 탐색 (포켓몬 검색)
 */
async function searchPokemonEggs(event, db) {
  const auth = await authenticate(event); // 인증 확인 (선택사항)
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.query;

  // 보안: 인증된 사용자 ID만 사용 (클라이언트가 전달한 userId는 무시)
  // 이렇게 하면 악의적인 사용자가 다른 사용자의 보유 정보를 조회할 수 없음
  const userId = auth?.userId || null;

  if (!searchQuery || searchQuery.length < 1) {
    return createSuccessResponse([]);
  }

  // 검색 로직:
  // 1. 이름으로 검색 (모든 포켓몬)
  // 2. 진화 트리를 역으로 탐색하여 Base 포켓몬 찾기
  // 3. Base 포켓몬의 정보 반환
  // 4. 사용자가 이미 보유한 포켓몬인지, 알이 있는지 확인

  const query = `
    WITH RECURSIVE evolution_base AS (
      -- 시작점: 검색된 포켓몬들
      SELECT 
        p.image_name,
        p.stable_id,
        p.name,
        p.base_stat_total,
        pfr.flag_name,
        1 as is_direct_match  -- 직접 검색된 포켓몬 표시
      FROM pokemon p
      LEFT JOIN pokemon_flag_relations pfr ON pfr.pokemon_stable_id = p.stable_id AND pfr.flag_name = 'Base'
      WHERE p.name LIKE CONCAT(?, '%')
      
      UNION ALL
      
      -- 재귀: Base가 아닌 경우 부모(pre-evolution) 찾기
      SELECT 
        pe.from_pokemon as image_name,
        parent.stable_id,
        parent.name,
        parent.base_stat_total,
        pfr_parent.flag_name,
        0 as is_direct_match  -- 진화체를 통해 찾은 포켓몬
      FROM evolution_base eb
      JOIN pokemon_evolutions pe ON pe.to_pokemon = eb.image_name
      JOIN pokemon parent ON parent.image_name = pe.from_pokemon
      LEFT JOIN pokemon_flag_relations pfr_parent ON pfr_parent.pokemon_stable_id = parent.stable_id AND pfr_parent.flag_name = 'Base'
      WHERE eb.flag_name IS NULL  -- Base가 아닌 경우만 계속 탐색
    ),
    final_results AS (
      SELECT DISTINCT
        eb.stable_id,
        eb.name,
        eb.image_name,
        eb.base_stat_total,
        ROUND(eb.base_stat_total * 0.1, 1) as hatch_hours,  -- 시간 단위
        -- 사용자가 이미 이 포켓몬을 보유하고 있는지 확인
        CASE 
          WHEN ? IS NOT NULL THEN 
            EXISTS(
              SELECT 1 FROM user_pokemon_collection upc 
              WHERE upc.user_id = ? AND upc.pokemon_stable_id = eb.stable_id
            )
          ELSE FALSE
        END as has_pokemon,
        -- 사용자가 이미 이 포켓몬의 알을 가지고 있는지 확인
        CASE 
          WHEN ? IS NOT NULL THEN 
            EXISTS(
              SELECT 1 FROM user_eggs ue 
              WHERE ue.user_id = ? AND ue.pokemon_stable_id = eb.stable_id
            )
          ELSE FALSE
        END as has_egg,
        MAX(eb.is_direct_match) as priority  -- 우선순위: 직접 매칭(1)이 진화체 매칭(0)보다 앞에
      FROM evolution_base eb
      WHERE eb.flag_name = 'Base'  -- Base 포켓몬만 선택
      GROUP BY eb.stable_id, eb.name, eb.image_name, eb.base_stat_total
    )
    SELECT 
      stable_id,
      name,
      image_name,
      base_stat_total,
      hatch_hours,
      has_pokemon,
      has_egg,
      priority,
      -- 획득 가능 여부 (has_pokemon=0 AND has_egg=0이면 1, 아니면 0)
      CASE WHEN has_pokemon = 0 AND has_egg = 0 THEN 1 ELSE 0 END as can_acquire
    FROM final_results
    ORDER BY 
      can_acquire DESC,  -- 획득 가능한 것 먼저 (1이 0보다 앞에)
      priority DESC,     -- 직접 매칭된 것 먼저 (1이 0보다 앞에)
      name               -- 이름 순
    LIMIT 20;
  `;

  const result = await db.query(query, [searchQuery, userId, userId, userId, userId]);
  return createSuccessResponse(result.rows);
}

/**
 * 알 획득
 */
async function acquireEgg(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { pokemonStableId } = requestBody;

  if (!pokemonStableId) {
    return createErrorResponse('Pokemon Stable ID is required', 400);
  }

  return await db.transaction(async (client) => {
    // 1. 둥근부적 확인 및 차감 (MySQL Syntax)
    const updateResult = await client.query(`
      UPDATE user_items ui
      JOIN items i ON ui.item_id = i.item_id
      SET ui.quantity = ui.quantity - 1, ui.updated_at = NOW()
      WHERE ui.user_id = ? 
        AND i.name = 'Oval Charm' 
        AND ui.quantity > 0
    `, [userId]);

    if (updateResult.affectedRows === 0) {
      // 업데이트된 행이 없으면 부적이 없거나 부족한 것임 (또는 아이템이 없음)
      throw new Error('둥근부적이 부족합니다...!');
    }

    // 차감 후 수량 조회
    const itemResult = await client.query(`
      SELECT ui.quantity FROM user_items ui
      JOIN items i ON ui.item_id = i.item_id
      WHERE ui.user_id = ? AND i.name = 'Oval Charm'
    `, [userId]);

    const remainingCharms = itemResult.rows[0]?.quantity || 0;

    // 2. 빈 슬롯 확인 (0, 1, 2 중 빈 곳)
    const slotsResult = await client.query(`
      SELECT slot_index FROM user_eggs WHERE user_id = ?
    `, [userId]);

    const occupiedSlots = slotsResult.rows.map(r => r.slot_index);
    let targetSlot = -1;
    for (let i = 0; i < 3; i++) {
      if (!occupiedSlots.includes(i)) {
        targetSlot = i;
        break;
      }
    }

    if (targetSlot === -1) {
      throw new Error('알 슬롯이 가득 찼습니다.');
    }

    // 3. 선택한 포켓몬의 Base 포켓몬 찾기
    const basePokemonResult = await client.query(`
      WITH RECURSIVE ancestors AS (
        -- 시작점: 선택된 포켓몬
        SELECT 
          p.image_name,
          p.stable_id,
          p.name,
          p.base_stat_total
        FROM pokemon p
        WHERE p.stable_id = ?
        
        UNION ALL
        
        -- 재귀: 부모 찾기
        SELECT 
          pe.from_pokemon as image_name,
          p.stable_id,
          p.name,
          p.base_stat_total
        FROM ancestors a
        JOIN pokemon_evolutions pe ON pe.to_pokemon = a.image_name
        JOIN pokemon p ON p.image_name = pe.from_pokemon
      ),
      ranked_ancestors AS (
        SELECT 
          a.stable_id,
          a.name,
          a.base_stat_total,
          ROW_NUMBER() OVER (PARTITION BY a.stable_id ORDER BY a.stable_id) as rn
        FROM ancestors a
        JOIN pokemon_flag_relations pfr ON pfr.pokemon_stable_id = a.stable_id
        JOIN pokemon_flags pf ON pf.name = pfr.flag_name
        WHERE pf.name = 'Base'
      )
      SELECT stable_id, name, base_stat_total
      FROM ranked_ancestors
      WHERE rn = 1
      LIMIT 1;
    `, [pokemonStableId]);

    if (basePokemonResult.rows.length === 0) {
      throw new Error('Base 포켓몬을 찾을 수 없습니다.');
    }

    const basePokemon = basePokemonResult.rows[0];
    const hatchHours = basePokemon.base_stat_total * 0.1; // 시간 단위

    // 4. Base 포켓몬으로 알 생성
    await client.query(`
      INSERT INTO user_eggs (
        user_id, pokemon_stable_id, slot_index, 
        obtained_at, hatch_at, is_hatched
      )
      VALUES (
        ?, ?, ?, 
        NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR), FALSE
      )
    `, [userId, basePokemon.stable_id, targetSlot, hatchHours]);

    logger.info('Egg acquired', { userId, pokemonStableId, slotIndex: targetSlot, remainingCharms });
    return createSuccessResponse({
      success: true,
      message: `${basePokemon.name} 알을 가져왔습니다!`,
      slot_index: targetSlot,
      remaining_charms: remainingCharms
    });
  });
}

/**
 * 알 부화
 */
async function hatchEgg(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { eggId } = requestBody;

  if (!eggId) {
    return createErrorResponse('Egg ID is required', 400);
  }

  return await db.transaction(async (client) => {
    // 1. 알 정보 조회
    const eggResult = await client.query(`
      SELECT 
        ue.egg_id,
        ue.user_id,
        ue.pokemon_stable_id,
        p.name as pokemon_name,
        ue.is_hatched,
        ue.hatch_at
      FROM user_eggs ue
      JOIN pokemon p ON ue.pokemon_stable_id = p.stable_id
      WHERE ue.egg_id = ? AND ue.user_id = ?
    `, [eggId, userId]);

    if (eggResult.rows.length === 0) {
      throw new Error('알을 찾을 수 없습니다.');
    }

    const egg = eggResult.rows[0];

    // 2. 부화 시간 확인
    const now = new Date();
    const hatchTime = new Date(egg.hatch_at);

    if (now < hatchTime) {
      throw new Error('아직 부화 시간이 되지 않았습니다.');
    }

    // 3. 이미 부화되었는지 확인
    if (egg.is_hatched) {
      throw new Error('이미 부화한 알입니다.');
    }

    // 4. 포켓몬 컬렉션에 추가 (중복 체크)
    const collectionCheck = await client.query(`
      SELECT collection_id FROM user_pokemon_collection
      WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = FALSE
    `, [userId, egg.pokemon_stable_id]);

    if (collectionCheck.rows.length === 0) {
      // 컬렉션에 없으면 추가
      await client.query(`
        INSERT INTO user_pokemon_collection (
          user_id, pokemon_stable_id, is_shiny, obtained_date
        ) VALUES (?, ?, FALSE, NOW())
      `, [userId, egg.pokemon_stable_id]);
    }

    // 5. 알 제거
    await client.query(`
      DELETE FROM user_eggs WHERE egg_id = ?
    `, [eggId]);

    logger.info('Egg hatched', {
      userId,
      eggId,
      pokemonStableId: egg.pokemon_stable_id,
      pokemonName: egg.pokemon_name,
      isNew: collectionCheck.rows.length === 0
    });

    return createSuccessResponse({
      success: true,
      message: `🎉 ${egg.pokemon_name}이(가) 부화했습니다!`,
      pokemon_stable_id: egg.pokemon_stable_id,
      pokemon_name: egg.pokemon_name,
      is_new: collectionCheck.rows.length === 0
    });
  });
}

module.exports = { handler: withErrorHandling(handler) };
