const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');
const { randomUUID } = require('crypto');

/**
 * 운동 데이터 관리 Lambda 함수
 * 
 * 지원하는 작업:
 * - GET /exercises - 사용자 운동 목록 조회
 * - POST /exercises - 새 운동 등록
 * - PUT /exercises/{id} - 운동 정보 수정
 * - DELETE /exercises/{id} - 운동 삭제
 * - GET /sessions - 운동 세션 기록 조회
 * - POST /sessions - 운동 세션 기록
 * - GET /muscle-groups - 근육 그룹 목록 조회
 * - GET /weekly-stats - 주간 운동 통계
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
  if (method === 'GET' && routePath.endsWith('/exercises')) {
    return await getUserExercises(event, db);
  } else if (method === 'POST' && routePath.endsWith('/exercises')) {
    return await createUserExercise(event, db);
  } else if (method === 'PUT' && routePath.includes('/exercises/')) {
    return await updateUserExercise(event, db, pathParameters.id);
  } else if (method === 'DELETE' && routePath.includes('/exercises/')) {
    return await deleteUserExercise(event, db, pathParameters.id);
  } else if (method === 'GET' && routePath.endsWith('/sessions')) {
    return await getExerciseSessions(event, db);
  } else if (method === 'POST' && routePath.endsWith('/sessions')) {
    return await createExerciseSession(event, db);
  } else if (method === 'GET' && routePath.endsWith('/muscle-groups')) {
    return await getMuscleGroups(event, db);
  } else if (method === 'GET' && routePath.endsWith('/weekly-stats')) {
    return await getWeeklyStats(event, db);
  } else {
    return createErrorResponse('Not Found', 404);
  }
};

/**
 * 사용자 운동 목록 조회
 */
async function getUserExercises(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const muscleGroupId = queryParams.muscleGroupId;

  try {
    let query = `
      SELECT 
        ue.id,
        ue.exercise_name,
        ue.weight_kg,
        ue.reps,
        ue.intensity_type,
        ue.rpe,
        ue.created_at,
        ue.updated_at,
        mg.id as muscle_group_id,
        mg.name as muscle_group_name,
        mg.name_ko as muscle_group_name_ko
      FROM user_exercises ue
      JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
      WHERE ue.user_id = ?
    `;

    const queryParams_array = [userId];

    if (muscleGroupId) {
      query += ' AND ue.muscle_group_id = ?';
      queryParams_array.push(muscleGroupId);
    }

    query += ' ORDER BY mg.name, ue.exercise_name';

    const result = await db.query(query, queryParams_array);

    return createSuccessResponse(result.rows);

  } catch (error) {
    logger.error('Failed to get user exercises', error);
    return createErrorResponse('Failed to get exercises', 500);
  }
}

/**
 * 새 운동 등록
 */
async function createUserExercise(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { exerciseName, muscleGroupId, weightKg, reps, intensityType, rpe } = requestBody;

  // 입력 검증
  if (!exerciseName || !muscleGroupId || !weightKg) {
    return createErrorResponse('Missing required fields: exerciseName, muscleGroupId, weightKg', 400);
  }

  if (typeof weightKg !== 'number' || weightKg <= 0) {
    return createErrorResponse('Weight must be a positive number', 400);
  }

  // intensityType 검증
  const validIntensityType = intensityType === 'rpe' ? 'rpe' : 'reps';

  if (validIntensityType === 'reps' && reps !== undefined && (typeof reps !== 'number' || reps <= 0)) {
    return createErrorResponse('Reps must be a positive number', 400);
  }

  if (validIntensityType === 'rpe' && rpe !== undefined && (typeof rpe !== 'number' || rpe < 1 || rpe > 10)) {
    return createErrorResponse('RPE must be a number between 1 and 10', 400);
  }

  try {
    // 근육 그룹 존재 확인
    const muscleGroupResult = await db.query(`
      SELECT id, name_ko FROM muscle_groups WHERE id = ?
    `, [muscleGroupId]);

    if (muscleGroupResult.rows.length === 0) {
      return createErrorResponse('Invalid muscle group ID', 400);
    }

    const newId = randomUUID();

    // 운동 등록 (intensity_type과 rpe 포함)
    await db.query(`
      INSERT INTO user_exercises (id, user_id, muscle_group_id, exercise_name, weight_kg, reps, intensity_type, rpe)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [newId, userId, muscleGroupId, exerciseName, weightKg,
      validIntensityType === 'reps' ? (reps || null) : null,
      validIntensityType,
      validIntensityType === 'rpe' ? (rpe || null) : null]);

    // 생성된 데이터 조회
    const result = await db.query(`
      SELECT created_at FROM user_exercises WHERE id = ?
    `, [newId]);

    const exercise = result.rows[0];

    logger.info('Exercise created', { userId, exerciseId: newId, exerciseName, muscleGroupId });

    return createSuccessResponse({
      id: newId,
      exerciseName,
      muscleGroupId,
      muscleGroupName: muscleGroupResult.rows[0].name_ko,
      weightKg,
      reps: validIntensityType === 'reps' ? reps : null,
      intensityType: validIntensityType,
      rpe: validIntensityType === 'rpe' ? rpe : null,
      createdAt: exercise.created_at
    });

  } catch (error) {
    logger.error('Failed to create exercise', error);
    return createErrorResponse('Failed to create exercise', 500);
  }
}

/**
 * 운동 정보 수정
 */
async function updateUserExercise(event, db, exerciseId) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { exerciseName, weightKg, reps, intensityType, rpe } = requestBody;

  if (!exerciseId) {
    return createErrorResponse('Exercise ID is required', 400);
  }

  try {
    // 운동 소유권 확인
    const ownershipResult = await db.query(`
      SELECT id FROM user_exercises WHERE id = ? AND user_id = ?
    `, [exerciseId, userId]);

    if (ownershipResult.rows.length === 0) {
      return createErrorResponse('Exercise not found or access denied', 404);
    }

    // 업데이트할 필드 구성
    const updateFields = [];
    const updateValues = [];

    if (exerciseName) {
      updateFields.push(`exercise_name = ?`);
      updateValues.push(exerciseName);
    }

    if (weightKg !== undefined) {
      if (typeof weightKg !== 'number' || weightKg <= 0) {
        return createErrorResponse('Weight must be a positive number', 400);
      }
      updateFields.push(`weight_kg = ?`);
      updateValues.push(weightKg);
    }

    // intensityType 처리
    if (intensityType !== undefined) {
      const validIntensityType = intensityType === 'rpe' ? 'rpe' : 'reps';
      updateFields.push(`intensity_type = ?`);
      updateValues.push(validIntensityType);

      if (validIntensityType === 'rpe') {
        // RPE 모드: reps를 null로, rpe 값 설정
        updateFields.push(`reps = ?`);
        updateValues.push(null);
        if (rpe !== undefined) {
          if (typeof rpe !== 'number' || rpe < 1 || rpe > 10) {
            return createErrorResponse('RPE must be a number between 1 and 10', 400);
          }
          updateFields.push(`rpe = ?`);
          updateValues.push(rpe);
        }
      } else {
        // Reps 모드: rpe를 null로, reps 값 설정
        updateFields.push(`rpe = ?`);
        updateValues.push(null);
        if (reps !== undefined) {
          if (reps !== null && (typeof reps !== 'number' || reps <= 0)) {
            return createErrorResponse('Reps must be a positive number', 400);
          }
          updateFields.push(`reps = ?`);
          updateValues.push(reps);
        }
      }
    } else {
      // intensityType이 없는 경우 기존 로직
      if (reps !== undefined) {
        if (reps !== null && (typeof reps !== 'number' || reps <= 0)) {
          return createErrorResponse('Reps must be a positive number', 400);
        }
        updateFields.push(`reps = ?`);
        updateValues.push(reps);
      }

      if (rpe !== undefined) {
        if (rpe !== null && (typeof rpe !== 'number' || rpe < 1 || rpe > 10)) {
          return createErrorResponse('RPE must be a number between 1 and 10', 400);
        }
        updateFields.push(`rpe = ?`);
        updateValues.push(rpe);
      }
    }

    if (updateFields.length === 0) {
      return createErrorResponse('No fields to update', 400);
    }

    updateFields.push('updated_at = NOW()');

    const updateQuery = `
      UPDATE user_exercises 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    await db.query(updateQuery, [...updateValues, exerciseId, userId]);

    const updatedRecordResult = await db.query(`
      SELECT id, exercise_name, weight_kg, reps, intensity_type, rpe, updated_at
      FROM user_exercises
      WHERE id = ?
    `, [exerciseId]);

    logger.info('Exercise updated', { userId, exerciseId, updates: updateFields });

    return createSuccessResponse({
      message: 'Exercise updated successfully',
      exercise: updatedRecordResult.rows[0]
    });

  } catch (error) {
    logger.error('Failed to update exercise', error);
    return createErrorResponse('Failed to update exercise', 500);
  }
}

/**
 * 운동 삭제
 */
async function deleteUserExercise(event, db, exerciseId) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!exerciseId || !userId) {
    return createErrorResponse('Exercise ID and User ID are required', 400);
  }

  try {
    // 삭제 전 정보 조회
    const checkResult = await db.query(`
      SELECT id, exercise_name FROM user_exercises WHERE id = ? AND user_id = ?
    `, [exerciseId, userId]);

    if (checkResult.rows.length === 0) {
      return createErrorResponse('Exercise not found or access denied', 404);
    }

    const exerciseToDelete = checkResult.rows[0];

    await db.query(`
      DELETE FROM user_exercises 
      WHERE id = ? AND user_id = ?
    `, [exerciseId, userId]);

    logger.info('Exercise deleted', { userId, exerciseId, exerciseName: exerciseToDelete.exercise_name });

    return createSuccessResponse({
      message: 'Exercise deleted successfully',
      deletedExercise: exerciseToDelete
    });

  } catch (error) {
    logger.error('Failed to delete exercise', error);
    return createErrorResponse('Failed to delete exercise', 500);
  }
}

/**
 * 운동 세션 기록 조회
 */
async function getExerciseSessions(event, db) {
  const auth = await authenticate(event);
  const queryParams = event.queryStringParameters || {};
  const userId = auth.isService ? queryParams.userId : auth.userId;

  if (!userId) {
    return createErrorResponse('User ID is required', 400);
  }

  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;
  const muscleGroupId = queryParams.muscleGroupId;
  const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
  const offset = parseInt(queryParams.offset) || 0;

  try {
    let whereConditions = ['es.user_id = ?'];
    let queryParams_array = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereConditions.push(`es.session_date >= ?`);
      queryParams_array.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`es.session_date <= ?`);
      queryParams_array.push(endDate);
      paramIndex++;
    }

    if (muscleGroupId) {
      whereConditions.push(`ue.muscle_group_id = ?`);
      queryParams_array.push(muscleGroupId);
      paramIndex++;
    }

    const query = `
      SELECT 
        es.id,
        es.sets_completed,
        es.session_date,
        es.notes,
        es.created_at,
        ue.id as exercise_id,
        ue.exercise_name,
        ue.weight_kg,
        ue.reps,
        mg.id as muscle_group_id,
        mg.name as muscle_group_name,
        mg.name_ko as muscle_group_name_ko
      FROM exercise_sessions es
      JOIN user_exercises ue ON es.exercise_id = ue.id
      JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY es.session_date DESC, es.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams_array.push(limit, offset);

    const result = await db.query(query, queryParams_array);

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM exercise_sessions es
      JOIN user_exercises ue ON es.exercise_id = ue.id
      WHERE ${whereConditions.slice(0, -2).join(' AND ')}
    `;

    const countResult = await db.query(countQuery, queryParams_array.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return createSuccessResponse({
      sessions: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    logger.error('Failed to get exercise sessions', error);
    return createErrorResponse('Failed to get exercise sessions', 500);
  }
}

/**
 * 운동 세션 기록
 */
async function createExerciseSession(event, db) {
  const { userId, requestBody } = await authenticateAndParseBody(event);
  const { exerciseId, setsCompleted, sessionDate, notes } = requestBody;

  // 입력 검증
  if (!exerciseId || !setsCompleted) {
    return createErrorResponse('Missing required fields: exerciseId, setsCompleted', 400);
  }

  if (typeof setsCompleted !== 'number' || setsCompleted <= 0) {
    return createErrorResponse('Sets completed must be a positive number', 400);
  }

  const finalSessionDate = sessionDate || new Date().toISOString().split('T')[0];

  try {
    // 운동 소유권 확인
    const exerciseResult = await db.query(`
      SELECT ue.id, ue.exercise_name, mg.name_ko as muscle_group_name
      FROM user_exercises ue
      JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
      WHERE ue.id = ? AND ue.user_id = ?
    `, [exerciseId, userId]);

    if (exerciseResult.rows.length === 0) {
      return createErrorResponse('Exercise not found or access denied', 404);
    }

    const exercise = exerciseResult.rows[0];

    // 세션 기록
    const newId = randomUUID();

    // 세션 기록
    await db.query(`
      INSERT INTO exercise_sessions (id, user_id, exercise_id, sets_completed, session_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [newId, userId, exerciseId, setsCompleted, finalSessionDate, notes]);

    const result = await db.query(`
      SELECT created_at FROM exercise_sessions WHERE id = ?
    `, [newId]);

    const session = result.rows[0];



    logger.info('Exercise session created', { userId, sessionId: newId, exerciseId, setsCompleted, sessionDate: finalSessionDate });

    return createSuccessResponse({
      id: newId,
      exerciseId,
      exerciseName: exercise.exercise_name,
      muscleGroupName: exercise.muscle_group_name,
      setsCompleted,
      sessionDate: finalSessionDate,
      notes,
      createdAt: session.created_at
    });

  } catch (error) {
    logger.error('Failed to create exercise session', error);
    return createErrorResponse('Failed to create exercise session', 500);
  }
}

/**
 * 근육 그룹 목록 조회
 */
async function getMuscleGroups(event, db) {
  try {
    const result = await db.query(`
      SELECT 
        id,
        name,
        name_ko,
        mv_sets,
        mev_sets,
        mav_min_sets,
        mav_max_sets,
        mrv_sets,
        created_at
      FROM muscle_groups
      ORDER BY name
    `);

    return createSuccessResponse(result.rows);

  } catch (error) {
    logger.error('Failed to get muscle groups', error);
    return createErrorResponse('Failed to get muscle groups', 500);
  }
}

/**
 * 주간 운동 통계 조회
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
    // 주의 시작일 계산 (월요일)
    const now = new Date();
    const currentDay = now.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday + (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const query = `
      WITH weekly_exercise_data AS (
        SELECT 
          ue.muscle_group_id,
          mg.name as muscle_group_name,
          mg.name_ko as muscle_group_name_ko,
          mg.mv_sets,
          mg.mev_sets,
          mg.mav_min_sets,
          mg.mav_max_sets,
          mg.mrv_sets,
          COALESCE(SUM(es.sets_completed), 0) as total_sets,
          COUNT(DISTINCT es.session_date) as workout_days,
          COUNT(es.id) as total_sessions
        FROM user_exercises ue
        JOIN muscle_groups mg ON ue.muscle_group_id = mg.id
        LEFT JOIN exercise_sessions es ON ue.id = es.exercise_id 
          AND es.session_date >= ? 
          AND es.session_date <= ?
        WHERE ue.user_id = ?
        GROUP BY ue.muscle_group_id, mg.name, mg.name_ko, mg.mv_sets, mg.mev_sets, mg.mav_min_sets, mg.mav_max_sets, mg.mrv_sets
      )
      SELECT 
        *,
        CASE 
          WHEN total_sets = 0 THEN 'not_started'
          WHEN total_sets < mev_sets THEN 'below_mev'
          WHEN total_sets >= mev_sets AND total_sets < mav_min_sets THEN 'mev_achieved'
          WHEN total_sets >= mav_min_sets THEN 'mav_achieved'
        END as achievement_status,
        ROUND((total_sets / mev_sets * 100), 1) as mev_progress,
        ROUND((total_sets / mav_max_sets * 100), 1) as mav_progress
      FROM weekly_exercise_data
      ORDER BY muscle_group_name
    `;

    // 파라미터 순서 수정: session_date 범위(?, ?)가 먼저 나오고, 그 다음 user_id(?)
    const result = await db.query(query, [
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0],
      userId
    ]);

    // 전체 통계 계산
    const totalSets = result.rows.reduce((sum, row) => sum + parseInt(row.total_sets), 0);
    const totalWorkoutDays = Math.max(...result.rows.map(row => parseInt(row.workout_days)), 0);
    const muscleGroupsWorked = result.rows.filter(row => parseInt(row.total_sets) > 0).length;
    const totalMuscleGroups = result.rows.length;

    return createSuccessResponse({
      weekPeriod: {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
        weekOffset
      },
      summary: {
        totalSets,
        totalWorkoutDays,
        muscleGroupsWorked,
        totalMuscleGroups,
        completionRate: totalMuscleGroups > 0 ? Math.round((muscleGroupsWorked / totalMuscleGroups) * 100) : 0
      },
      muscleGroups: result.rows
    });

  } catch (error) {
    logger.error('Failed to get weekly stats', error);
    return createErrorResponse('Failed to get weekly stats', 500);
  }
}

module.exports = { handler: withErrorHandling(handler) };