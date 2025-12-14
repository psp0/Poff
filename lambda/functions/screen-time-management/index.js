const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');
const { processScreenTimeRewards, parseUsageCode } = require('../../shared/screen-time-rewards');

/**
 * 스크린타임 관리 Lambda 함수
 * 
 * 지원하는 작업:
 * - GET /screen-time - 스크린타임 기록 조회
 * - POST /screen-time - 스크린타임 기록 추가
 * - DELETE /screen-time/{date} - 특정 날짜 스크린타임 삭제
 * - GET /weekly-stats - 주간 스크린타임 통계
 * - GET /monthly-stats - 월간 스크린타임 통계
 * - POST /reward-check - 스크린타임 감소 보상 확인
 */

const handler = async (event, context) => {
  const db = getDatabase();
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path;
  const pathParameters = event.pathParameters || {};

  // 라우팅
  if (method === 'GET' && path.endsWith('/screen-time')) {
    return await getScreenTimeRecords(event, db);
  } else if (method === 'POST' && path.endsWith('/screen-time')) {
    return await saveScreenTimeRecord(event, db);
  } else if (method === 'DELETE' && path.includes('/screen-time/')) {
    return await deleteScreenTimeRecord(event, db, pathParameters.date);
  } else if (method === 'GET' && path.endsWith('/weekly-stats')) {
    return await getWeeklyStats(event, db);
  } else if (method === 'GET' && path.endsWith('/monthly-stats')) {
    return await getMonthlyStats(event, db);
  } else if (method === 'POST' && path.endsWith('/reward-check')) {
    return await checkScreenTimeReward(event, db);
  } else {
    return createErrorResponse('Not Found', 404);
  }
};

/**
 * 스크린타임 기록 조회
 */
async function getScreenTimeRecords(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;
  const limit = Math.min(parseInt(queryParams.limit) || 30, 100);
  const offset = parseInt(queryParams.offset) || 0;

  try {
    let whereConditions = ['user_id = ?'];
    let queryParams_array = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`date >= $${paramIndex}`);
      queryParams_array.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`date <= $${paramIndex}`);
      queryParams_array.push(endDate);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        date,
        usage_hours,
        usage_minutes,
        (usage_hours * 60 + usage_minutes) as total_minutes,
        created_at
      FROM screen_time
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams_array.push(limit, offset);

    const result = await db.query(query, queryParams_array);

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM screen_time
      WHERE ${whereConditions.slice(0, -2).join(' AND ')}
    `;

    const countResult = await db.query(countQuery, queryParams_array.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return createSuccessResponse({
      records: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    logger.error('Failed to get screen time records', error);
    return createErrorResponse('Failed to get screen time records', 500);
  }
}

/**
 * 스크린타임 기록 추가 (보상 포함)
 * 
 * 요청 형식:
 * 1. usageCode 방식 (권장): { date, usageCode, isOver10Hours? }
 * 2. 시/분 방식: { date, usageHours, usageMinutes }
 */
async function saveScreenTimeRecord(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { date, usageCode, isOver10Hours = false, usageHours: rawHours, usageMinutes: rawMinutes } = requestBody;

  // 입력 검증 - date 필수
  if (!date) {
    return createErrorResponse('Date is required', 400);
  }

  // 날짜 형식 검증
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return createErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
  }

  // 시간 파싱 - usageCode 또는 usageHours/usageMinutes
  let usageHours, usageMinutes;

  if (usageCode !== undefined) {
    // usageCode 방식 파싱
    const parsed = parseUsageCode(usageCode, isOver10Hours);
    if (parsed.error) {
      return createErrorResponse(parsed.error, 400);
    }
    usageHours = parsed.hours;
    usageMinutes = parsed.minutes;
  } else if (rawHours !== undefined && rawMinutes !== undefined) {
    // 직접 시/분 방식
    usageHours = rawHours;
    usageMinutes = rawMinutes;

    if (typeof usageHours !== 'number' || usageHours < 0 || usageHours > 24) {
      return createErrorResponse('Usage hours must be between 0 and 24', 400);
    }

    if (typeof usageMinutes !== 'number' || usageMinutes < 0 || usageMinutes >= 60) {
      return createErrorResponse('Usage minutes must be between 0 and 59', 400);
    }
  } else {
    return createErrorResponse('Either usageCode or (usageHours, usageMinutes) is required', 400);
  }

  // 미래 날짜 방지
  const recordDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (recordDate > today) {
    return createErrorResponse('Cannot record screen time for future dates', 400);
  }

  // 오늘 입력 시, 어제 기록이 없으면 입력 불가 (순차적 입력 강제)
  const inputDate = new Date(date);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate.getTime() === todayDate.getTime()) {
    // 오늘 입력인 경우, 어제 기록 확인
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayResult = await db.query(
      'SELECT id FROM screen_time WHERE user_id = ? AND date = ?',
      [userId, yesterdayStr]
    );

    if (yesterdayResult.rows.length === 0) {
      return createErrorResponse('어제 스크린타임을 먼저 입력해주세요.', 400);
    }
  }

  try {
    // 트랜잭션으로 기록 저장 + 보상 처리
    return await db.transaction(async (client) => {
      // 기존 기록 확인 (새 기록 여부)
      const existingResult = await client.query(
        'SELECT id FROM screen_time WHERE user_id = ? AND date = ?',
        [userId, date]
      );
      const isNewEntry = existingResult.rows.length === 0;

      // 스크린타임 기록 저장 (UPSERT)
      await client.query(`
        INSERT INTO screen_time (user_id, date, usage_hours, usage_minutes)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          usage_hours = VALUES(usage_hours),
          usage_minutes = VALUES(usage_minutes),
          created_at = NOW()
      `, [userId, date, usageHours, usageMinutes]);

      // 보상 처리 (새 기록인 경우에만)
      const rewardResult = await processScreenTimeRewards(
        client, userId, date, usageHours, usageMinutes, isNewEntry
      );

      // 주간 통계 업데이트 (비동기, 실패해도 계속)
      try {
        await updateWeeklyStatsInTransaction(client, userId, date);
      } catch (statsError) {
        logger.warn('Weekly stats update failed', { errorMessage: statsError.message });
      }

      // 기록 ID 조회
      const recordResult = await client.query(
        'SELECT id FROM screen_time WHERE user_id = ? AND date = ?',
        [userId, date]
      );
      const recordId = recordResult.rows[0]?.id;

      const totalMinutes = usageHours * 60 + usageMinutes;

      logger.info('Screen time recorded', {
        userId,
        date,
        totalMinutes,
        isNewEntry,
        rewards: rewardResult.rewards
      });

      return createSuccessResponse({
        success: true,
        id: recordId,
        date,
        usage: {
          hours: usageHours,
          minutes: usageMinutes,
          totalMinutes
        },
        isNewEntry,
        weeklyComparison: {
          lastWeekAvgMinutes: rewardResult.lastWeekAvgMinutes,
          changePercentage: rewardResult.changePercentage,
          comparisonResult: rewardResult.comparisonResult
        },
        rewards: rewardResult.rewards,
        message: isNewEntry ? 'Screen time recorded with rewards' : 'Screen time updated (no rewards for duplicate)'
      });
    });

  } catch (error) {
    logger.error('Failed to save screen time record', error);
    return createErrorResponse('Failed to save screen time record', 500);
  }
}

/**
 * 트랜잭션 내에서 주간 통계 업데이트
 */
async function updateWeeklyStatsInTransaction(client, userId, date) {
  const recordDate = new Date(date);
  const dayOfWeek = recordDate.getDay(); // 0=Sun

  // Calculate start of the week (Sunday)
  const weekStart = new Date(recordDate);
  weekStart.setDate(recordDate.getDate() - dayOfWeek);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  await client.query(`
    INSERT INTO screen_time_weekly_stats (
      user_id, 
      week_start_date, 
      week_end_date, 
      avg_daily_minutes, 
      total_days_logged, 
      total_minutes
    )
    SELECT 
      ?,
      ?,
      ?,
      AVG(usage_hours * 60 + usage_minutes),
      COUNT(*),
      SUM(usage_hours * 60 + usage_minutes)
    FROM screen_time
    WHERE user_id = ? 
      AND date >= ? 
      AND date <= ?
    ON DUPLICATE KEY UPDATE 
      avg_daily_minutes = VALUES(avg_daily_minutes),
      total_days_logged = VALUES(total_days_logged),
      total_minutes = VALUES(total_minutes),
      updated_at = NOW()
  `, [
    userId,
    weekStart.toISOString().split('T')[0],
    weekEnd.toISOString().split('T')[0],
    userId,
    weekStart.toISOString().split('T')[0],
    weekEnd.toISOString().split('T')[0]
  ]);
}

/**
 * 특정 날짜 스크린타임 삭제
 */
async function deleteScreenTimeRecord(event, db, date) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!date || !userId) {
    return createErrorResponse('Date and User ID are required', 400);
  }

  try {
    const result = await db.query(`
      DELETE FROM screen_time 
      WHERE user_id = ? AND date = ?
      RETURNING id, usage_hours, usage_minutes
    `, [userId, date]);

    if (result.rows.length === 0) {
      return createErrorResponse('Screen time record not found', 404);
    }

    // 주간 통계 업데이트
    await updateWeeklyStats(db, userId, date);

    return createSuccessResponse({
      message: 'Screen time record deleted',
      deletedRecord: {
        date,
        usageHours: result.rows[0].usage_hours,
        usageMinutes: result.rows[0].usage_minutes
      }
    });

  } catch (error) {
    logger.error('Failed to delete screen time record', error);
    return createErrorResponse('Failed to delete screen time record', 500);
  }
}

/**
 * 주간 스크린타임 통계 조회
 */
async function getWeeklyStats(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const weekOffset = parseInt(queryParams.weekOffset) || 0; // 0: 이번 주, -1: 지난 주

  try {
    // 주의 시작일 계산 (일요일)
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay + (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const query = `
      WITH daily_stats AS (
        SELECT 
          date,
          usage_hours,
          usage_minutes,
          (usage_hours * 60 + usage_minutes) as total_minutes
        FROM screen_time
        WHERE user_id = ? 
          AND date >= ? 
          AND date <= ?
        ORDER BY date
      ),
      week_summary AS (
        SELECT 
          COUNT(*) as days_logged,
          SUM(total_minutes) as total_minutes,
          AVG(total_minutes) as avg_daily_minutes,
          MIN(total_minutes) as min_daily_minutes,
          MAX(total_minutes) as max_daily_minutes
        FROM daily_stats
      )
      SELECT 
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', date,
            'hours', usage_hours,
            'minutes', usage_minutes,
            'totalMinutes', total_minutes
          ) ORDER BY date
        ) FROM daily_stats) as daily_records,
        ws.days_logged,
        ws.total_minutes,
        ROUND(ws.avg_daily_minutes, 1) as avg_daily_minutes,
        ws.min_daily_minutes,
        ws.max_daily_minutes
      FROM week_summary ws
    `;

    const result = await db.query(query, [
      userId,
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0]
    ]);

    const stats = result.rows[0];

    // 이전 주와 비교
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(weekEnd.getDate() - 7);

    const prevWeekResult = await db.query(`
      SELECT 
        COALESCE(AVG(usage_hours * 60 + usage_minutes), 0) as prev_avg_daily_minutes
      FROM screen_time
      WHERE user_id = ? 
        AND date >= ? 
        AND date <= ?
    `, [
      userId,
      prevWeekStart.toISOString().split('T')[0],
      prevWeekEnd.toISOString().split('T')[0]
    ]);

    const prevAvgMinutes = parseFloat(prevWeekResult.rows[0].prev_avg_daily_minutes);
    const currentAvgMinutes = parseFloat(stats.avg_daily_minutes) || 0;
    const changeFromPrevWeek = prevAvgMinutes > 0 ?
      ((currentAvgMinutes - prevAvgMinutes) / prevAvgMinutes * 100) : 0;

    return createSuccessResponse({
      weekPeriod: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
        weekOffset
      },
      summary: {
        daysLogged: parseInt(stats.days_logged) || 0,
        totalMinutes: parseInt(stats.total_minutes) || 0,
        avgDailyMinutes: currentAvgMinutes,
        minDailyMinutes: parseInt(stats.min_daily_minutes) || 0,
        maxDailyMinutes: parseInt(stats.max_daily_minutes) || 0,
        totalHours: Math.floor((parseInt(stats.total_minutes) || 0) / 60),
        avgDailyHours: Math.floor(currentAvgMinutes / 60)
      },
      comparison: {
        prevWeekAvgMinutes: prevAvgMinutes,
        changeFromPrevWeek: Math.round(changeFromPrevWeek * 10) / 10,
        isImprovement: changeFromPrevWeek < 0 // 감소가 개선
      },
      dailyRecords: stats.daily_records || []
    });

  } catch (error) {
    logger.error('Failed to get weekly stats', error);
    return createErrorResponse('Failed to get weekly stats', 500);
  }
}

/**
 * 월간 스크린타임 통계 조회
 */
async function getMonthlyStats(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const year = parseInt(queryParams.year) || new Date().getFullYear();
  const month = parseInt(queryParams.month) || (new Date().getMonth() + 1);

  try {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const query = `
      WITH daily_stats AS (
        SELECT 
          date,
          usage_hours,
          usage_minutes,
          (usage_hours * 60 + usage_minutes) as total_minutes,
          DAYOFWEEK(date) - 1 as day_of_week
        FROM screen_time
        WHERE user_id = ? 
          AND date >= ? 
          AND date <= ?
        ORDER BY date
      ),
      weekly_averages AS (
        SELECT 
          WEEK(date, 1) as week_number,
          AVG(usage_hours * 60 + usage_minutes) as avg_minutes
        FROM screen_time
        WHERE user_id = ? 
          AND date >= ? 
          AND date <= ?
        GROUP BY WEEK(date, 1)
        ORDER BY week_number
      )
      SELECT 
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'date', date,
            'hours', usage_hours,
            'minutes', usage_minutes,
            'totalMinutes', total_minutes,
            'dayOfWeek', day_of_week
          ) ORDER BY date
        ) FROM daily_stats) as daily_records,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'week', week_number,
            'avgMinutes', ROUND(avg_minutes, 1)
          ) ORDER BY week_number
        ) FROM weekly_averages) as weekly_averages,
        COUNT(*) as days_logged,
        SUM(total_minutes) as total_minutes,
        AVG(total_minutes) as avg_daily_minutes,
        MIN(total_minutes) as min_daily_minutes,
        MAX(total_minutes) as max_daily_minutes
      FROM daily_stats
    `;

    const result = await db.query(query, [
      userId,
      monthStart.toISOString().split('T')[0],
      monthEnd.toISOString().split('T')[0]
    ]);

    const stats = result.rows[0];

    return createSuccessResponse({
      monthPeriod: {
        year,
        month,
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
        daysInMonth: monthEnd.getDate()
      },
      summary: {
        daysLogged: parseInt(stats.days_logged) || 0,
        totalMinutes: parseInt(stats.total_minutes) || 0,
        avgDailyMinutes: Math.round(parseFloat(stats.avg_daily_minutes) || 0),
        minDailyMinutes: parseInt(stats.min_daily_minutes) || 0,
        maxDailyMinutes: parseInt(stats.max_daily_minutes) || 0,
        totalHours: Math.floor((parseInt(stats.total_minutes) || 0) / 60),
        completionRate: Math.round(((parseInt(stats.days_logged) || 0) / monthEnd.getDate()) * 100)
      },
      dailyRecords: stats.daily_records || [],
      weeklyAverages: stats.weekly_averages || []
    });

  } catch (error) {
    logger.error('Failed to get monthly stats', error);
    return createErrorResponse('Failed to get monthly stats', 500);
  }
}

/**
 * 스크린타임 감소 보상 확인
 */
async function checkScreenTimeReward(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { targetDate } = requestBody;

  const checkDate = targetDate || new Date().toISOString().split('T')[0];

  try {
    // 오늘과 어제의 스크린타임 비교
    const yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const comparisonResult = await db.query(`
      SELECT 
        today.usage_hours * 60 + today.usage_minutes as today_minutes,
        yesterday.usage_hours * 60 + yesterday.usage_minutes as yesterday_minutes
      FROM 
        (SELECT usage_hours, usage_minutes FROM screen_time WHERE user_id = ? AND date = ?) today
      FULL OUTER JOIN 
        (SELECT usage_hours, usage_minutes FROM screen_time WHERE user_id = ? AND date = ?) yesterday
      ON true
    `, [userId, checkDate, yesterday.toISOString().split('T')[0]]);

    if (comparisonResult.rows.length === 0) {
      return createSuccessResponse({
        eligible: false,
        message: '스크린타임 기록이 부족합니다...!',
        todayMinutes: null,
        yesterdayMinutes: null
      });
    }

    const comparison = comparisonResult.rows[0];
    const todayMinutes = parseInt(comparison.today_minutes) || 0;
    const yesterdayMinutes = parseInt(comparison.yesterday_minutes) || 0;

    // 감소량 계산 (최소 30분 이상 감소해야 보상)
    const reduction = yesterdayMinutes - todayMinutes;
    const minReduction = 30; // 30분
    const eligible = reduction >= minReduction && yesterdayMinutes > 0;

    // 이미 오늘 보상을 받았는지 확인
    const existingRewardResult = await db.query(`
      SELECT id FROM user_pokemon_collection
      WHERE user_id = ? 
        AND obtained_reason = '스크린타임 감소'
        AND obtained_date::date = ?
    `, [userId, checkDate]);

    const alreadyRewarded = existingRewardResult.rows.length > 0;

    let message = '';
    if (alreadyRewarded) {
      message = '오늘 이미 스크린타임 감소 보상을 받으셨습니다.';
    } else if (!eligible) {
      if (yesterdayMinutes === 0) {
        message = '어제 스크린타임 기록이 없어 비교할 수 없습니다.';
      } else if (reduction < minReduction) {
        message = `스크린타임을 ${minReduction}분 이상 줄여야 보상을 받을 수 있습니다.`;
      } else {
        message = '스크린타임이 증가했습니다.';
      }
    } else {
      message = `축하합니다! 스크린타임을 ${reduction}분 줄였습니다!`;
    }

    return createSuccessResponse({
      eligible: eligible && !alreadyRewarded,
      todayMinutes,
      yesterdayMinutes,
      reduction,
      reductionHours: Math.floor(Math.abs(reduction) / 60),
      reductionMinutes: Math.abs(reduction) % 60,
      minReductionRequired: minReduction,
      alreadyRewarded,
      message
    });

  } catch (error) {
    logger.error('Failed to check screen time reward', error);
    return createErrorResponse('Failed to check reward eligibility', 500);
  }
}

/**
 * 주간 통계 업데이트
 */
async function updateWeeklyStats(db, userId, date) {
  try {
    const recordDate = new Date(date);
    const dayOfWeek = recordDate.getDay(); // 0=Sun

    // Calculate start of the week (Sunday)
    const weekStart = new Date(recordDate);
    weekStart.setDate(recordDate.getDate() - dayOfWeek);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // 주간 통계 계산 및 업데이트
    await db.query(`
      INSERT INTO screen_time_weekly_stats (
        user_id, 
        week_start_date, 
        week_end_date, 
        avg_daily_minutes, 
        total_days_logged, 
        total_minutes
      )
      SELECT 
        ?,
        ?,
        ?,
        AVG(usage_hours * 60 + usage_minutes),
        COUNT(*),
        SUM(usage_hours * 60 + usage_minutes)
      FROM screen_time
      WHERE user_id = ? 
        AND date >= ? 
        AND date <= ?
      ON DUPLICATE KEY UPDATE 
        avg_daily_minutes = VALUES(avg_daily_minutes),
        total_days_logged = VALUES(total_days_logged),
        total_minutes = VALUES(total_minutes),
        updated_at = NOW()
    `, [
      userId,
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0],
      userId,
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0]
    ]);

  } catch (error) {
    logger.warn('Failed to update weekly stats', { errorMessage: error.message });
    // 주간 통계 업데이트 실패는 전체 프로세스를 중단시키지 않음
  }
}

module.exports = { handler: withErrorHandling(handler) };