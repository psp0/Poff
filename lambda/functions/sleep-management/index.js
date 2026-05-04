const { getDatabase } = require('../../shared/database');
const { authenticateAndParseBody, authenticate } = require('../../shared/auth');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { logger } = require('../../shared/logger');

/**
 * 수면 관리 Lambda 함수
 * 
 * 지원하는 작업:
 * - POST /api/sleep - 수면 기록 저장
 * - GET /api/sleep/status - 수면 보상 현황 조회
 * - POST /api/sleep/reward - 수면 보상 지급 (Refresh)
 */

const SLEEP_REWARD_TABLE = {
    weekday: {
        // 22: 100, 23: 90, 0: 80, 1: 70, 2: 50, 3: 40, 4: 30
        22: 100, 23: 80, 0: 70, 1: 60, 2: 40, 3: 30, 4: 20
    },
    weekend: {
        // 22: 100, 23: 95, 0: 90, 1: 80, 2: 70, 3: 50, 4: 40
        22: 100, 23: 90, 0: 80, 1: 70, 2: 60, 3: 40, 4: 30
    }
};

const handler = async (event, context) => {
    const db = getDatabase();
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;

    // Normalize path
    const stage = event.requestContext?.stage;
    let normalizedPath = path;
    if (stage && stage !== '$default' && path.startsWith(`/${stage}/`)) {
        normalizedPath = path.substring(stage.length + 1);
    }
    const routePath = normalizedPath;

    if (method === 'POST' && routePath.endsWith('/sleep')) {
        return await saveSleepLog(event, db);
    } else if (method === 'GET' && routePath.endsWith('/sleep/status')) {
        return await getSleepStatus(event, db);
    } else if (method === 'POST' && routePath.endsWith('/sleep/reward')) {
        return await processSleepReward(event, db);
    } else {
        return createErrorResponse('Not Found', 404);
    }
};

/**
 * 새벽 4시 기준으로 수면 날짜 계산
 * 예: 12월 27일 01:00 -> 12월 26일로 간주 (26일 밤에 잔 것)
 *     12월 27일 05:00 -> 12월 27일로 간주 (27일 밤에 잘 예정)
 * @param {number} timestamp - 수면 시작 시간 (epoch ms)
 * @returns {string} YYYY-MM-DD 형식의 수면 날짜
 */
function calculateSleepDate(timestamp) {
    // 한국 시간대로 변환 (UTC+9)
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(timestamp + koreaOffset);

    // 새벽 4시(04:00) 기준 - 4시 이전이면 전날로 간주
    const hours = koreaTime.getUTCHours();

    if (hours < 4) {
        // 4시 이전이면 전날 날짜
        koreaTime.setUTCDate(koreaTime.getUTCDate() - 1);
    }

    // YYYY-MM-DD 형식으로 반환
    return koreaTime.toISOString().split('T')[0];
}

/**
 * 수면 시각에 따른 보상 퍼센트 계산
 * 
 * - 새벽 4시 ~ 오후 10시(22:00): 100%
 * - 오후 10시(22:00)부터 시간별 차등 감소:

 * @param {number} sleepStartTime - 수면 시작 시간 (epoch ms)
 * @param {boolean} isWeekendOrHoliday - 주말 또는 공휴일 여부
 * @returns {number} 보상 퍼센트 (0-100)
 */
function calculateRewardPercentage(sleepStartTime, isWeekendOrHoliday) {
    // 한국 시간대로 변환
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(sleepStartTime + koreaOffset);

    const hours = koreaTime.getUTCHours();
    const minutes = koreaTime.getUTCMinutes();

    const table = isWeekendOrHoliday ? SLEEP_REWARD_TABLE.weekend : SLEEP_REWARD_TABLE.weekday;

    // 새벽 4시 ~ 오후 10시: 100%
    if (hours >= 5 && hours < 22) {
        return 100;
    }

    // 오후 10시 이후부터 새벽 4시까지: 시간별 룩업
    if (hours >= 22 || hours <= 4) {
        // 해당 시간의 기준 퍼센트
        const currentHourPercentage = table[hours];

        if (currentHourPercentage === undefined) {
            // 정의되지 않은 시간대 (예외 처리)
            return 0;
        }

        // 다음 시간의 퍼센트 (없으면 현재 퍼센트 유지)
        const nextHour = (hours + 1) % 24;
        const nextHourPercentage = table[nextHour];

        if (nextHourPercentage === undefined) {
            // 다음 시간이 정의되지 않은 경우 현재 시간 퍼센트 반환
            return currentHourPercentage;
        }

        // 분 단위로 선형 보간
        const percentageDiff = nextHourPercentage - currentHourPercentage;
        const minuteFraction = minutes / 60;
        const interpolatedPercentage = currentHourPercentage + (percentageDiff * minuteFraction);

        return Math.max(0, Math.round(interpolatedPercentage * 100) / 100);
    }

    // 그 외 시간 (새벽 5시~오후 9시): 100%
    return 100;
}

/**
 * 수면 기록 저장
 */
async function saveSleepLog(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);

    if (!userId) {
        return createErrorResponse('Unauthorized: User ID is missing', 401);
    }

    const { start, end, duration } = requestBody;

    if (!start || !end || !duration) {
        return createErrorResponse('Missing required fields', 400);
    }

    // 4시간 = 14,400,000 ms
    const MIN_SLEEP_DURATION = 14400000;
    if (duration < MIN_SLEEP_DURATION) {
        return createErrorResponse('Sleep duration must be at least 4 hours', 400);
    }

    try {
        // 보안 강화: 클라이언트의 start, end 시간을 신뢰하지 않고 서버 시간 기준으로 재계산
        // duration은 클라이언트가 측정한 수면 시간이므로 신뢰 (단, 최소 시간 체크로 보완)
        const serverEnd = Date.now();
        const serverStart = serverEnd - duration;

        // 수면 날짜 계산 (4AM 기준)
        const sleepDate = calculateSleepDate(serverStart);

        // 해당 날짜에 이미 수면 기록이 있는지 확인
        const existingResult = await db.query(
            `SELECT id FROM sleep_logs WHERE user_id = ? AND sleep_date = ?`,
            [userId, sleepDate]
        );

        if (existingResult.rows.length > 0) {
            return createErrorResponse('이미 오늘은 수면을 기록했습니다. 밤에 다시 시도해주세요.', 400);
        }

        // 주말/공휴일 여부 확인 (수면 종료 시점 = 일어나는 날 기준)
        const isWakeUpDayOff = await checkWeekendOrHoliday(db, serverEnd);

        // 보상 퍼센트 계산
        const rewardPercentage = calculateRewardPercentage(serverStart, isWakeUpDayOff);

        // 수면 기록 저장
        const query = `
            INSERT INTO sleep_logs (user_id, start_time, end_time, duration, sleep_date, reward_percentage, rewarded)
            VALUES (?, ?, ?, ?, ?, ?, false)
        `;
        const insertResult = await db.query(query, [userId, serverStart, serverEnd, duration, sleepDate, rewardPercentage]);
        const sleepLogId = insertResult.insertId;

        // 보상 자동 지급 처리
        let rewardResult = null;
        if (rewardPercentage > 0) {
            rewardResult = await processRewardInternal(db, userId, sleepDate, rewardPercentage, sleepLogId);
        } else {
            // 보상 0%인 경우 완료 처리
            await db.query(`UPDATE sleep_logs SET rewarded = true WHERE id = ?`, [sleepLogId]);
        }

        logger.info('Sleep log saved and rewarded', {
            userId,
            sleepDate,
            rewardPercentage,
            rewardedCount: rewardResult?.rewardedPokemon?.length || 0,
            startTime: new Date(start).toISOString()
        });

        return createSuccessResponse({
            message: '수면 기록이 저장되고 보상이 지급되었습니다.',
            sleepDate,
            rewardPercentage,
            rewardedPokemon: rewardResult?.rewardedPokemon || []
        });
    } catch (error) {
        logger.error('Error saving sleep log', error);
        throw error;
    }
}

/**
 * 보상 지급 내부 로직
 */
async function processRewardInternal(db, userId, sleepDate, rewardPercentage, sleepLogId) {
    // 현재 한국 시간 기준 "오늘" 계산 (4AM 기준)
    const koreaOffset = 9 * 60 * 60 * 1000;
    const now = Date.now();
    const koreaTime = new Date(now + koreaOffset);
    const hours = koreaTime.getUTCHours();

    // 오늘 4AM 시작점 계산
    let todayStart = new Date(koreaTime);
    todayStart.setUTCHours(4, 0, 0, 0);

    if (hours < 4) {
        todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }

    const todayStartTimestamp = todayStart.getTime() - koreaOffset;
    const todayEndTimestamp = todayStartTimestamp + 24 * 60 * 60 * 1000;

    // 오늘 획득한 포켓몬 조회 (이로치 제외, 이미 shiny를 보유한 포켓몬 제외, base_stat_total 높은순)
    const pokemonQuery = `
        SELECT 
            p.stable_id,
            p.name,
            p.base_stat_total
        FROM user_pokemon_collection upc
        INNER JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
        WHERE upc.user_id = ?
          AND upc.is_shiny = false
          AND upc.obtained_date >= FROM_UNIXTIME(? / 1000)
          AND upc.obtained_date < FROM_UNIXTIME(? / 1000)
          AND NOT EXISTS (
              SELECT 1 FROM user_pokemon_collection upc_shiny
              WHERE upc_shiny.user_id = upc.user_id
                AND upc_shiny.pokemon_stable_id = upc.pokemon_stable_id
                AND upc_shiny.is_shiny = true
          )
        ORDER BY p.base_stat_total DESC
    `;

    const pokemonResult = await db.query(pokemonQuery, [
        userId,
        todayStartTimestamp,
        todayEndTimestamp
    ]);

    const todayPokemon = pokemonResult.rows || [];
    const rewardedPokemon = [];

    if (todayPokemon.length > 0) {
        const totalPokemon = todayPokemon.length;

        for (let i = 0; i < totalPokemon; i++) {
            // 100%를 제외하고 균등 배치
            const position = ((i + 1) / (totalPokemon + 1)) * 100;

            if (position <= rewardPercentage) {
                const pokemon = todayPokemon[i];

                // 이미 이로치를 가지고 있는지 확인
                const existingShiny = await db.query(
                    `SELECT 1 FROM user_pokemon_collection 
                     WHERE user_id = ? AND pokemon_stable_id = ? AND is_shiny = true`,
                    [userId, pokemon.stable_id]
                );

                if (existingShiny.rows.length === 0) {
                    // 이로치 포켓몬 지급
                    await db.query(
                        `INSERT INTO user_pokemon_collection 
                         (user_id, pokemon_stable_id, is_shiny, obtained_reason)
                         VALUES (?, ?, true, '수면 보상')`,
                        [userId, pokemon.stable_id]
                    );

                    rewardedPokemon.push({
                        stable_id: pokemon.stable_id,
                        name: pokemon.name,
                        base_stat_total: pokemon.base_stat_total,
                        position
                    });
                }
            }
        }
    }

    // 보상 완료 처리
    await db.query(
        `UPDATE sleep_logs SET rewarded = true WHERE id = ?`,
        [sleepLogId]
    );

    return { rewardedPokemon };
}

/**
 * 주말 또는 공휴일 여부 확인
 */
async function checkWeekendOrHoliday(db, timestamp) {
    // 한국 시간으로 변환
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(timestamp + koreaOffset);

    // 요일 확인 (0 = 일요일, 6 = 토요일)
    const dayOfWeek = koreaTime.getUTCDay();

    // 주말인 경우
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return true;
    }

    // 공휴일 확인
    const dateStr = koreaTime.toISOString().split('T')[0];
    const holidayResult = await db.query(
        `SELECT 1 FROM date_info WHERE date = ? AND is_holiday = true`,
        [dateStr]
    );

    return holidayResult.rows.length > 0;
}

/**
 * 수면 보상 현황 조회
 * 오늘(4AM 기준) 획득한 포켓몬 목록과 현재 수면 보상 상태
 */
async function getSleepStatus(event, db) {
    const auth = await authenticate(event);
    const queryParams = event.queryStringParameters || {};
    const userId = auth.isService ? queryParams.userId : auth.userId;

    if (!userId) {
        return createErrorResponse('User ID is required', 400);
    }

    // 현재 한국 시간 기준 "오늘" 계산 (4AM 기준)
    const now = Date.now();
    const koreaOffset = 9 * 60 * 60 * 1000;
    const koreaTime = new Date(now + koreaOffset);
    const hours = koreaTime.getUTCHours();

    // 오늘 4AM 시작점 계산
    let todayStart = new Date(koreaTime);
    todayStart.setUTCHours(4, 0, 0, 0);

    if (hours < 4) {
        // 현재 4시 이전이면 어제 4AM부터
        todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    }

    // UTC timestamp 변환
    const todayStartTimestamp = todayStart.getTime() - koreaOffset;
    const todayEndTimestamp = todayStartTimestamp + 24 * 60 * 60 * 1000;

    const assetsBaseUrl = (process.env.ASSETS_BASE_URL || '').replace(/\/$/, '') + '/';

    // 오늘 획득한 포켓몬 조회 (이로치 제외, 이미 shiny를 보유한 포켓몬 제외, base_stat_total 높은순)
    const pokemonQuery = `
    SELECT
    p.stable_id,
        p.name,
        p.image_name,
        p.form_suffix,
        p.base_stat_total,
        p.asset_source,
        p.has_icon,
        p.has_icon_shiny,
        upc.obtained_date,
            (
                WITH RECURSIVE ancestry_chain AS(
    SELECT
    p_start.stable_id,
        p_start.image_name,
        0 as level
                  FROM pokemon p_start
                  WHERE p_start.stable_id = p.stable_id

    UNION

    SELECT
    p_parent.stable_id,
        p_parent.image_name,
        ac.level + 1
                  FROM ancestry_chain ac
                  JOIN pokemon p_equiv ON p_equiv.image_name = ac.image_name
                  JOIN pokemon_evolutions pe ON pe.to_pokemon = p_equiv.stable_id
                  JOIN pokemon p_parent ON p_parent.stable_id = pe.from_pokemon
                )
                SELECT image_name FROM ancestry_chain ORDER BY level DESC LIMIT 1
            ) AS base_image_name,
        CONCAT(?,
            CASE 
                    WHEN p.has_icon_shiny = 1 THEN
                        CASE 
                            WHEN p.asset_source = 'external' THEN 'external/img/Icons%20shiny/'
                            ELSE 'base/img/Icons%20shiny/'
                        END
                    WHEN p.has_icon_shiny = 0 AND p.has_icon = 1 AND p.form_suffix IS NOT NULL THEN
                        CASE 
                            WHEN p.asset_source = 'external' THEN 'external/img/Icons/'
                            ELSE 'base/img/Icons/'
                        END
                    WHEN p.has_icon_shiny = 0 AND p.has_icon = 0 AND p.form_suffix IS NOT NULL THEN
                        CASE 
                            WHEN COALESCE(p_base.asset_source, 'base') = 'external' THEN 'external/img/Icons%20shiny/'
                            ELSE 'base/img/Icons%20shiny/'
                        END
                    ELSE
                        CASE 
                            WHEN p.asset_source = 'external' THEN 'external/img/Icons/'
                            ELSE 'base/img/Icons/'
                        END
                END,
            CASE 
                    WHEN p.has_icon_shiny = 1 AND p.form_suffix IS NOT NULL 
                    THEN CONCAT(p.image_name, p.form_suffix, '.png')
                    WHEN p.has_icon_shiny = 0 AND p.has_icon = 1 AND p.form_suffix IS NOT NULL
                    THEN CONCAT(p.image_name, p.form_suffix, '.png')
                    WHEN p.has_icon_shiny = 0 AND p.has_icon = 0 AND p.form_suffix IS NOT NULL
                    THEN CONCAT(p.image_name, '.png')
                    ELSE CONCAT(p.image_name, '.png')
                END
        ) AS icon_shiny_url
        FROM user_pokemon_collection upc
        INNER JOIN pokemon p ON upc.pokemon_stable_id = p.stable_id
        LEFT JOIN pokemon p_base ON p_base.image_name = p.image_name AND(p_base.form_suffix IS NULL OR p_base.form_suffix = '')
        WHERE upc.user_id = ?
        AND upc.is_shiny = false
          AND upc.obtained_date >= FROM_UNIXTIME(? / 1000)
          AND upc.obtained_date < FROM_UNIXTIME(? / 1000)
          AND NOT EXISTS(
            SELECT 1 FROM user_pokemon_collection upc_shiny
              WHERE upc_shiny.user_id = upc.user_id
                AND upc_shiny.pokemon_stable_id = upc.pokemon_stable_id
                AND upc_shiny.is_shiny = true
        )
        ORDER BY p.base_stat_total DESC
        `;

    const pokemonResult = await db.query(pokemonQuery, [
        assetsBaseUrl,
        userId,
        todayStartTimestamp,
        todayEndTimestamp
    ]);

    // 오늘의 수면 기록 확인 (sleep_date 기준)
    const todayDateStr = calculateSleepDate(now);
    const sleepLogQuery = `
        SELECT reward_percentage, rewarded, start_time
        FROM sleep_logs
        WHERE user_id = ? AND sleep_date = ?
        ORDER BY created_at DESC
        LIMIT 1
        `;

    const sleepLogResult = await db.query(sleepLogQuery, [userId, todayDateStr]);

    let currentRewardPercentage = 0;
    let canSleepToday = true;
    let lastSleepTime = null;
    let alreadyRewarded = false;

    if (sleepLogResult.rows.length > 0) {
        const sleepLog = sleepLogResult.rows[0];
        currentRewardPercentage = parseFloat(sleepLog.reward_percentage || 0);
        canSleepToday = false;
        alreadyRewarded = sleepLog.rewarded;
        lastSleepTime = sleepLog.start_time;
    }

    // "일어나는 날" 판단: 현재 시각으로부터 가장 가까운 미래의 04:01 KST가 어떤 날인지 확인
    // - 04:00 이전 (00:00 ~ 03:59) → 오늘 04:01이 "일어나는 시점" → 오늘 날짜
    // - 04:00 이후 (04:00 ~ 23:59) → 내일 04:01이 "일어나는 시점" → 내일 날짜
    const koreaTimeNow = new Date(now + koreaOffset);
    const currentHour = koreaTimeNow.getUTCHours();

    // 다음 04:01 KST 계산
    let nextWakeUpTime = new Date(koreaTimeNow);
    nextWakeUpTime.setUTCHours(4, 1, 0, 0); // 04:01:00.000 KST

    if (currentHour >= 4) {
        // 이미 04:00을 지났으면 내일 04:01로 설정
        nextWakeUpTime.setUTCDate(nextWakeUpTime.getUTCDate() + 1);
    }

    // UTC timestamp로 변환하여 checkWeekendOrHoliday 호출
    const nextWakeUpTimestamp = nextWakeUpTime.getTime() - koreaOffset;
    const isWakeUpDayOff = await checkWeekendOrHoliday(db, nextWakeUpTimestamp);

    // 현재 시간 기준 예상 보상 퍼센트 계산
    const expectedPercentage = calculateRewardPercentage(now, isWakeUpDayOff);

    return createSuccessResponse({
        todayPokemon: pokemonResult.rows || [],
        sleepStatus: {
            canSleepToday,
            alreadyRewarded,
            currentRewardPercentage,
            expectedPercentage,
            isWakeUpDayOff,  // 변수명 변경: 일어나는 날이 쉬는 날인지
            lastSleepTime,
            rewardTable: isWakeUpDayOff ? SLEEP_REWARD_TABLE.weekend : SLEEP_REWARD_TABLE.weekday
        },
        todayDate: todayDateStr
    });
}

/**
 * 수면 보상 지급 (Refresh 버튼)
 * 오늘 획득한 포켓몬 중 퍼센트에 해당하는 포켓몬들의 이로치 지급
 */
async function processSleepReward(event, db) {
    // 이 함수는 이제 REFRESH 버튼에서 상태를 새로고침하는 용도로만 사용되거나, 
    // 기존 클라이언트 호환성을 위해 유지하되 getSleepStatus와 유사한 결과를 반환할 수 있습니다.
    // 하지만 사용자가 보상받기 버튼을 없앴으므로, 여기서는 그냥 상태만 반환합니다.
    return await getSleepStatus(event, db);
}

module.exports = { handler: withErrorHandling(handler) };
