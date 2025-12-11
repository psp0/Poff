const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');

/**
 * 운동 보상 시스템 Lambda 함수
 * 
 * 지원하는 작업:
 * - POST /reward/shiny - 운동 완료 시 이로치 포켓몬 보상
 * - POST /reward/check-eligibility - 보상 자격 확인
 * - GET /reward/history - 보상 히스토리 조회
 * - POST /reward/milestone - 마일스톤 달성 보상
 */

const handler = async (event, context) => {
  const db = getDatabase();
  const method = event.httpMethod;
  const path = event.path;

  // 라우팅
  if (method === 'POST' && path.endsWith('/reward/shiny')) {
    return await rewardShinyPokemon(event, db);
  } else if (method === 'POST' && path.endsWith('/reward/check-eligibility')) {
    return await checkRewardEligibility(event, db);
  } else if (method === 'GET' && path.endsWith('/reward/history')) {
    return await getRewardHistory(event, db);
  } else if (method === 'POST' && path.endsWith('/reward/milestone')) {
    return await rewardMilestone(event, db);
  } else {
    return createErrorResponse('Not Found', 404);
  }
};

/**
 * 운동 완료 시 이로치 포켓몬 보상
 */
async function rewardShinyPokemon(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { sessionId, muscleGroupId } = requestBody;

  if (!sessionId) {
    return createErrorResponse('Session ID is required', 400);
  }

  try {
    return await db.transaction(async (client) => {
      // 세션 소유권 및 유효성 확인
      const sessionResult = await client.query(`
        SELECT 
          es.id,
          es.sets_completed,
          es.session_date,
          ue.muscle_group_id,
          mg.name_ko as muscle_group_name,
          mg.mev_sets
        FROM exercise_sessions es
        JOIN user_exercises ue ON es.exercise_id = ue.id
        JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
        WHERE es.id = ? AND es.user_id = ?
      `, [sessionId, userId]);

      if (sessionResult.rows.length === 0) {
        throw new Error('Exercise session not found or access denied');
      }

      const session = sessionResult.rows[0];

      // 이미 보상을 받았는지 확인
      const existingRewardResult = await client.query(`
        SELECT id FROM user_pokemon_collection
        WHERE user_id = ? 
          AND obtained_reason = '운동 보상'
          AND obtained_date::date = ?
          AND pokemon_stable_id IN (
            SELECT pokemon_stable_id FROM user_pokemon_collection 
            WHERE user_id = ? AND is_shiny = true
          )
      `, [userId, session.session_date]);

      if (existingRewardResult.rows.length > 0) {
        return createSuccessResponse({
          success: false,
          message: '오늘 이미 운동 보상을 받으셨습니다.',
          alreadyRewarded: true
        });
      }

      // 최소 MEV의 50% 이상 달성했는지 확인
      const minSetsRequired = Math.ceil(session.mev_sets * 0.5);
      if (session.sets_completed < minSetsRequired) {
        return createSuccessResponse({
          success: false,
          message: `보상을 받으려면 최소 ${minSetsRequired}세트 이상 운동해야 합니다.`,
          currentSets: session.sets_completed,
          requiredSets: minSetsRequired
        });
      }

      // 사용자가 일반 버전은 보유했지만 이로치는 없는 포켓몬 중 랜덤 선택
      // 제외 플래그: Legendary, Mythical, Paradox, UltraBeast (pokemon_flag_relations는 flag_name 사용)
      const rewardPokemonResult = await client.query(`
        SELECT p.stable_id, p.name
        FROM pokemon p
        WHERE 
          -- 사용자가 일반 버전을 보유한 포켓몬
          p.stable_id IN (
            SELECT pokemon_stable_id 
            FROM user_pokemon_collection 
            WHERE user_id = ? 
              AND is_shiny = false
          )
          -- 이로치 버전은 아직 없는 포켓몬
          AND p.stable_id NOT IN (
            SELECT pokemon_stable_id 
            FROM user_pokemon_collection 
            WHERE user_id = ? 
              AND is_shiny = true
          )
          -- 제외 플래그가 없는 포켓몬만
          AND NOT EXISTS (
            SELECT 1 
            FROM pokemon_flag_relations pfr
            WHERE pfr.pokemon_stable_id = p.stable_id
              AND pfr.flag_name IN ('Legendary', 'Mythical', 'Paradox', 'UltraBeast')
          )
        ORDER BY RAND()
        LIMIT 1
      `, [userId, userId]);

      if (rewardPokemonResult.rows.length === 0) {
        return createSuccessResponse({
          success: false,
          message: '획득 가능한 이로치 포켓몬이 없습니다.',
          noAvailablePokemon: true
        });
      }

      const rewardPokemon = rewardPokemonResult.rows[0];

      // 선택된 포켓몬을 이로치로 추가
      await client.query(`
        INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, is_shiny, obtained_reason)
        VALUES (?, ?, true, '운동 보상')
        ON DUPLICATE KEY UPDATE (user_id, pokemon_stable_id, is_shiny) DO NOTHING
      `, [userId, rewardPokemon.stable_id]);

      logger.info('Shiny pokemon rewarded', { userId, pokemonId: rewardPokemon.stable_id, reason: 'Exercise Reward' });

      return createSuccessResponse({
        success: true,
        reward_pokemon: rewardPokemon.stable_id,
        pokemon_name: rewardPokemon.name,
        is_shiny: true,
        message: `축하합니다! 이로치 ${rewardPokemon.name}을(를) 획득했습니다!`,
        session: {
          muscleGroup: session.muscle_group_name,
          setsCompleted: session.sets_completed,
          sessionDate: session.session_date
        }
      });
    });

  } catch (error) {
    logger.error('Failed to reward shiny pokemon', error);
    return createErrorResponse('Failed to process reward', 500);
  }
}

/**
 * 보상 자격 확인
 */
async function checkRewardEligibility(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { sessionId } = requestBody;

  if (!sessionId) {
    return createErrorResponse('Session ID is required', 400);
  }

  try {
    // 세션 정보 조회
    const sessionResult = await db.query(`
      SELECT 
        es.id,
        es.sets_completed,
        es.session_date,
        ue.muscle_group_id,
        mg.name_ko as muscle_group_name,
        mg.mev_sets
      FROM exercise_sessions es
      JOIN user_exercises ue ON es.exercise_id = ue.id
      JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
      WHERE es.id = ? AND es.user_id = ?
    `, [sessionId, userId]);

    if (sessionResult.rows.length === 0) {
      return createErrorResponse('Exercise session not found or access denied', 404);
    }

    const session = sessionResult.rows[0];

    // 오늘 이미 보상을 받았는지 확인
    const todayRewardResult = await db.query(`
      SELECT COUNT(*) as count
      FROM user_pokemon_collection
      WHERE user_id = ? 
        AND obtained_reason = '운동 보상'
        AND obtained_date::date = ?
    `, [userId, session.session_date]);

    const alreadyRewarded = parseInt(todayRewardResult.rows[0].count) > 0;

    // 최소 세트 요구사항
    const minSetsRequired = Math.ceil(session.mev_sets * 0.5);
    const meetsRequirement = session.sets_completed >= minSetsRequired;

    // 사용 가능한 이로치 포켓몬 수 확인
    const availablePokemonResult = await db.query(`
      SELECT COUNT(*) as count
      FROM pokemon p
      WHERE 
        p.stable_id IN (
          SELECT pokemon_stable_id 
          FROM user_pokemon_collection 
          WHERE user_id = ? AND is_shiny = false
        )
        AND p.stable_id NOT IN (
          SELECT pokemon_stable_id 
          FROM user_pokemon_collection 
          WHERE user_id = ? AND is_shiny = true
        )
        AND NOT EXISTS (
          SELECT 1 
          FROM pokemon_flag_relations pfr
          WHERE pfr.pokemon_stable_id = p.stable_id
            AND pfr.flag_name IN ('Legendary', 'Mythical', 'Paradox', 'UltraBeast')
        )
    `, [userId, userId]);

    const availablePokemonCount = parseInt(availablePokemonResult.rows[0].count);

    return createSuccessResponse({
      eligible: meetsRequirement && !alreadyRewarded && availablePokemonCount > 0,
      session: {
        id: session.id,
        muscleGroup: session.muscle_group_name,
        setsCompleted: session.sets_completed,
        sessionDate: session.session_date
      },
      requirements: {
        minSetsRequired,
        meetsRequirement,
        alreadyRewarded,
        availablePokemonCount
      },
      message: !meetsRequirement
        ? `최소 ${minSetsRequired}세트 이상 운동해야 합니다.`
        : alreadyRewarded
          ? '오늘 이미 보상을 받으셨습니다.'
          : availablePokemonCount === 0
            ? '획득 가능한 이로치 포켓몬이 없습니다.'
            : '보상을 받을 수 있습니다!'
    });

  } catch (error) {
    logger.error('Failed to check reward eligibility', error);
    return createErrorResponse('Failed to check eligibility', 500);
  }
}

/**
 * 보상 히스토리 조회
 */
async function getRewardHistory(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const limit = Math.min(parseInt(queryParams.limit) || 20, 50);
  const offset = parseInt(queryParams.offset) || 0;
  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;

  try {
    let whereConditions = ['upc.user_id = ?', "upc.obtained_reason = '운동 보상'"];
    let queryParams_array = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`upc.obtained_date >= $${paramIndex}`);
      queryParams_array.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`upc.obtained_date <= $${paramIndex}`);
      queryParams_array.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        upc.collection_id,
        upc.pokemon_stable_id,
        upc.is_shiny,
        upc.obtained_date,
        upc.obtained_reason,
        p.name as pokemon_name,
        p.type1,
        p.type2,
        p.category
      FROM user_pokemon_collection upc
      JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY upc.obtained_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams_array.push(limit, offset);

    const result = await db.query(query, queryParams_array);

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_pokemon_collection upc
      WHERE ${whereConditions.slice(0, -2).join(' AND ')}
    `;

    const countResult = await db.query(countQuery, queryParams_array.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // 통계 정보
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_rewards,
        COUNT(DISTINCT DATE(obtained_date)) as reward_days,
        MIN(obtained_date) as first_reward,
        MAX(obtained_date) as last_reward
      FROM user_pokemon_collection
      WHERE user_id = ? AND obtained_reason = '운동 보상'
    `, [userId]);

    const stats = statsResult.rows[0];

    return createSuccessResponse({
      rewards: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      statistics: {
        totalRewards: parseInt(stats.total_rewards),
        rewardDays: parseInt(stats.reward_days),
        firstReward: stats.first_reward,
        lastReward: stats.last_reward
      }
    });

  } catch (error) {
    logger.error('Failed to get reward history', error);
    return createErrorResponse('Failed to get reward history', 500);
  }
}

/**
 * 마일스톤 달성 보상
 */
async function rewardMilestone(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { milestoneType, muscleGroupId, weekCount } = requestBody;

  if (!milestoneType) {
    return createErrorResponse('Milestone type is required', 400);
  }

  try {
    return await db.transaction(async (client) => {
      let rewardMessage = '';
      let pokemonCount = 1;

      // 마일스톤 타입별 보상 설정
      switch (milestoneType) {
        case 'weekly_mev_complete':
          // 주간 MEV 완전 달성
          rewardMessage = '주간 MEV 완전 달성 보상';
          pokemonCount = 1;
          break;
        case 'weekly_mav_complete':
          // 주간 MAV 완전 달성
          rewardMessage = '주간 MAV 완전 달성 보상';
          pokemonCount = 2;
          break;
        case 'consecutive_weeks':
          // 연속 주간 달성
          rewardMessage = `${weekCount}주 연속 운동 달성 보상`;
          pokemonCount = Math.min(weekCount, 3);
          break;
        default:
          throw new Error('Invalid milestone type');
      }

      // 이미 해당 마일스톤 보상을 받았는지 확인
      const existingMilestoneResult = await client.query(`
        SELECT id FROM user_pokemon_collection
        WHERE user_id = ? 
          AND obtained_reason = ?
          AND obtained_date::date = CURRENT_DATE
      `, [userId, rewardMessage]);

      if (existingMilestoneResult.rows.length > 0) {
        return createSuccessResponse({
          success: false,
          message: '오늘 이미 해당 마일스톤 보상을 받으셨습니다.',
          alreadyRewarded: true
        });
      }

      // 보상 포켓몬 선택 및 지급
      const rewardedPokemon = [];

      for (let i = 0; i < pokemonCount; i++) {
        // 사용 가능한 포켓몬 조회 (이미 보상받은 것 제외)
        const availablePokemonResult = await client.query(`
          SELECT p.stable_id, p.name
          FROM pokemon p
          WHERE 
            p.stable_id IN (
              SELECT pokemon_stable_id 
              FROM user_pokemon_collection 
              WHERE user_id = ? AND is_shiny = false
            )
            AND p.stable_id NOT IN (
              SELECT pokemon_stable_id 
              FROM user_pokemon_collection 
              WHERE user_id = ? AND is_shiny = true
            )
            AND NOT EXISTS (
              SELECT 1 
              FROM pokemon_flag_relations pfr
              WHERE pfr.pokemon_stable_id = p.stable_id
                AND pfr.flag_name IN ('Legendary', 'Mythical', 'Paradox', 'UltraBeast')
            )
          ORDER BY RAND()
          LIMIT 1
        `, [userId, userId]);

        if (availablePokemonResult.rows.length === 0) {
          break; // 더 이상 보상할 포켓몬이 없음
        }

        const pokemon = availablePokemonResult.rows[0];

        // 이로치 포켓몬 지급
        await client.query(`
          INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, is_shiny, obtained_reason)
          VALUES (?, ?, true, ?)
          ON DUPLICATE KEY UPDATE (user_id, pokemon_stable_id, is_shiny) DO NOTHING
        `, [userId, pokemon.stable_id, rewardMessage]);

        rewardedPokemon.push(pokemon);
      }

      return createSuccessResponse({
        success: true,
        milestoneType,
        message: `축하합니다! ${rewardMessage}으로 ${rewardedPokemon.length}마리의 이로치 포켓몬을 획득했습니다!`,
        rewardedPokemon: rewardedPokemon.map(p => ({
          stable_id: p.stable_id,
          name: p.name,
          is_shiny: true
        })),
        rewardCount: rewardedPokemon.length
      });
    });

  } catch (error) {
    logger.error('Failed to process milestone reward', error);
    return createErrorResponse('Failed to process milestone reward', 500);
  }
}

module.exports = { handler: withErrorHandling(handler) };