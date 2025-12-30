const { logger } = require('./logger');

/**
 * 스크린타임 보상 계산 및 지급 모듈
 * 
 * 전주 평균 대비 감소율에 따라 보상을 지급합니다.
 * - 아이템: 신비의 부적, 이상한 사탕, 둥근부적
 * - 포켓몬: 기초, 전설/울트라비스트, 패러독스/환상
 * - 특별 이벤트: 공휴일, 토요일, 포켓몬 데이(2/27)
 */

/**
 * 변화율에 따른 보상 티어 결정
 * @param {number} changePercentage - 전주 평균 대비 변화율 (%)
 * @param {number} hours - 사용 시간 (시)
 * @returns {Object} 보상 정보
 */
function calculateRewardTier(changePercentage, hours) {
    let mysticCharmCount = 0;
    let rareCandyCount = 0;
    let basePokemonCount = 0;
    let ovalCharmCount = 0;
    let giveLegendary = false;
    let giveParadoxMythical = false;
    let comparisonResult = null;

    if (changePercentage <= -40 || hours <= 2) {
        // -40% 이상 또는 2시간대 이하
        mysticCharmCount = 5;
        rareCandyCount = 6;
        basePokemonCount = 3;
        ovalCharmCount = 2;
        giveLegendary = true;
        giveParadoxMythical = true;
        comparisonResult = '전주 평균 대비 -40% 이상 감소 또는 2시간 이하 사용';
    } else if (changePercentage <= -30 || hours === 3) {
        // -30% 또는 3시간대
        mysticCharmCount = 5;
        rareCandyCount = 6;
        basePokemonCount = 3;
        ovalCharmCount = 2;
        giveLegendary = true;
        comparisonResult = '전주 평균 대비 -30%~-40% 감소 또는 3시간대 사용';
    } else if (changePercentage <= -20) {
        mysticCharmCount = 4;
        rareCandyCount = 5;
        basePokemonCount = 3;
        ovalCharmCount = 1;
        comparisonResult = '전주 평균 대비 -20%~-30% 감소';
    } else if (changePercentage <= -10) {
        mysticCharmCount = 3;
        rareCandyCount = 4;
        basePokemonCount = 2;
        ovalCharmCount = 1;
        comparisonResult = '전주 평균 대비 -10%~-20% 감소';
    } else if (changePercentage < 0) {
        mysticCharmCount = 2;
        rareCandyCount = 3;
        basePokemonCount = 2;
        comparisonResult = '전주 평균 대비 0~-10% 감소';
    } else if (changePercentage < 10) {
        mysticCharmCount = 1;
        rareCandyCount = 3;
        comparisonResult = '전주 평균 대비 0~+10% 증가';
    } else if (changePercentage < 20) {
        mysticCharmCount = 1;
        rareCandyCount = 2;
        comparisonResult = '전주 평균 대비 +10%~+20% 증가';
    } else if (changePercentage < 30) {
        rareCandyCount = 2;
        comparisonResult = '전주 평균 대비 +20%~+30% 증가';
    } else if (changePercentage < 40) {
        mysticCharmCount = 1;
        comparisonResult = '전주 평균 대비 +30%~+40% 증가';
    } else {
        comparisonResult = '전주 평균 대비 +40% 이상 증가 (보상 없음)';
    }

    return {
        mysticCharmCount,
        rareCandyCount,
        basePokemonCount,
        ovalCharmCount,
        giveLegendary,
        giveParadoxMythical,
        comparisonResult
    };
}

/**
 * 전주 평균 계산을 위한 날짜 범위 반환
 * @param {string} date - 기록 날짜 (YYYY-MM-DD)
 * @returns {Object} { lastWeekStart, lastWeekEnd }
 */
function getLastWeekDates(date) {
    const recordDate = new Date(date);
    let dayOfWeek = recordDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Treat Sunday as 7 to align with Monday-Sunday week logic for "previous week" calculation
    if (dayOfWeek === 0) {
        dayOfWeek = 7;
    }

    // Calculate start of the current week (Monday-based logic applied to Sunday-based dates)
    // If today is Sunday (7), we go back 7 days to get to previous Sunday?
    // No, the function returns Sunday-based dates.
    // If input is Jan 5 (Sun), we want lastWeekStart = Dec 22 (Sun).
    // Jan 5 - 7 = Dec 29 (Sun). This is "currentWeekStart" (start of the week ending Jan 5).
    // Dec 29 - 7 = Dec 22 (Sun). This is "lastWeekStart".

    const currentWeekStart = new Date(recordDate);
    currentWeekStart.setDate(recordDate.getDate() - dayOfWeek);

    // Previous week start (Last Sunday)
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Previous week end (Last Saturday)
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

    return {
        lastWeekStart: lastWeekStart.toISOString().split('T')[0],
        lastWeekEnd: lastWeekEnd.toISOString().split('T')[0]
    };
}

/**
 * 아이템 지급 헬퍼 함수
 * @param {Object} client - DB 클라이언트 (트랜잭션)
 * @param {string} userId - 사용자 ID
 * @param {string} itemName - 아이템 이름
 * @param {number} quantity - 수량
 */
async function grantItem(client, userId, itemName, quantity) {
    if (quantity <= 0) return;

    const itemResult = await client.query(
        `SELECT item_id FROM items WHERE name = ? LIMIT 1`,
        [itemName]
    );

    if (itemResult.rows.length > 0) {
        const itemId = itemResult.rows[0].item_id;
        await client.query(`
      INSERT INTO user_items (user_id, item_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity),
        updated_at = NOW()
    `, [userId, itemId, quantity]);
    }
}

/**
 * 플래그 기반 랜덤 포켓몬 지급
 * @param {Object} client - DB 클라이언트 (트랜잭션)
 * @param {string} userId - 사용자 ID
 * @param {string[]} flagNames - 플래그 이름 배열 (예: ['Base'], ['Legendary', 'UltraBeast'])
 * @param {string} reason - 획득 사유
 * @param {number} count - 지급 수량 (기본 1)
 * @param {string[]} excludeIds - 제외할 포켓몬 stable_id 배열
 * @param {boolean} excludeForms - 폼(예: _1, _2) 제외 여부
 * @returns {string[]} 지급된 포켓몬 stable_id 배열
 */
async function grantRandomPokemon(client, userId, flagNames, reason, count = 1, excludeIds = [], excludeForms = false) {
    const grantedPokemon = [];

    // flag_name으로 직접 조회 (pokemon_flag_relations 테이블은 flag_name을 사용)
    const flagPlaceholders = flagNames.map(() => '?').join(', ');

    for (let i = 0; i < count; i++) {
        // 이미 소유한 포켓몬과 제외 대상 제외
        const allExcluded = [...excludeIds, ...grantedPokemon];
        const excludePlaceholders = allExcluded.length > 0
            ? `AND p.stable_id NOT IN (${allExcluded.map(() => '?').join(', ')})`
            : '';

        // 폼 제외 조건 (예: _1, _2 등으로 끝나는 ID 제외)
        // MySQL REGEXP 사용: _[숫자]로 끝나는 패턴 제외
        const formExcludeCondition = excludeForms
            ? "AND p.stable_id NOT REGEXP '_[0-9]+$'"
            : '';

        const queryParams = [
            ...flagNames,
            userId,
            ...(allExcluded.length > 0 ? allExcluded : [])
        ];

        const pokemonResult = await client.query(`
      SELECT p.stable_id
      FROM pokemon p
      INNER JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
      WHERE pfr.flag_name IN (${flagPlaceholders})
        AND NOT EXISTS (
          SELECT 1 FROM user_pokemon_collection
          WHERE user_id = ? AND pokemon_stable_id = p.stable_id
        )
        ${excludePlaceholders}
        ${formExcludeCondition}
      ORDER BY RAND()
      LIMIT 1
    `, queryParams);

        if (pokemonResult.rows.length > 0) {
            const pokemonId = pokemonResult.rows[0].stable_id;

            await client.query(`
        INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, obtained_reason)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE obtained_reason = obtained_reason
      `, [userId, pokemonId, reason]);

            grantedPokemon.push(pokemonId);
        } else {
            // 더 이상 받을 포켓몬이 없으면 중단
            break;
        }
    }

    return grantedPokemon;
}

/**
 * 스크린타임 보상 처리 메인 함수
 * @param {Object} client - DB 클라이언트 (트랜잭션)
 * @param {string} userId - 사용자 ID
 * @param {string} date - 기록 날짜 (YYYY-MM-DD)
 * @param {number} hours - 사용 시간 (시)
 * @param {number} minutes - 사용 시간 (분)
 * @param {boolean} isNewEntry - 새로운 기록 여부
 * @returns {Object} 보상 결과
 */
async function processScreenTimeRewards(client, userId, date, hours, minutes, isNewEntry) {
    // 보상 결과 초기화
    const result = {
        lastWeekAvgMinutes: null,
        changePercentage: null,
        comparisonResult: null,
        rewards: {
            mysticCharmReceived: 0,
            rareCandyReceived: 0,
            ovalCharmReceived: 0,
            basePokemonList: [],
            legendaryPokemon: null,
            mythicalPokemon: null,
            specialDayPokemon: null,
            specialDayType: null,
            shinyCharmReceived: 0,
            brillianceCharmReceived: 0
        }
    };

    // // 새로운 기록이 아니면 보상 없음
    // if (!isNewEntry) {
    //     return result;
    // }

    const usageMinutes = hours * 60 + minutes;

    // 공휴일 여부 확인
    const holidayCheck = await client.query(
        'SELECT 1 FROM holidays WHERE holiday_date = CURRENT_DATE',
        []
    );
    const isHoliday = holidayCheck.rows.length > 0;

    // 토요일 여부 확인
    const dayOfWeek = new Date().getDay();
    const isSaturday = dayOfWeek === 6;

    // 전주 평균 조회
    const { lastWeekStart, lastWeekEnd } = getLastWeekDates(date);
    logger.debug('Checking last week stats', { lastWeekStart, lastWeekEnd, recordDate: date });
    const lastWeekStatsResult = await client.query(
        'SELECT avg_daily_minutes FROM screen_time_weekly_stats WHERE user_id = ? AND week_start_date = ?',
        [userId, lastWeekStart]
    );

    if (lastWeekStatsResult.rows.length > 0) {
        const lastWeekAvgMinutes = parseFloat(lastWeekStatsResult.rows[0].avg_daily_minutes);
        result.lastWeekAvgMinutes = lastWeekAvgMinutes;

        if (lastWeekAvgMinutes > 0) {
            const changePercentage = ((usageMinutes - lastWeekAvgMinutes) / lastWeekAvgMinutes) * 100;
            result.changePercentage = Math.round(changePercentage * 100) / 100;

            // 보상 티어 계산
            const tier = calculateRewardTier(changePercentage, hours);
            result.comparisonResult = tier.comparisonResult;

            // 아이템 지급
            await grantItem(client, userId, 'Mystic Charm', tier.mysticCharmCount);
            await grantItem(client, userId, 'Rare Candy', tier.rareCandyCount);
            await grantItem(client, userId, 'Oval Charm', tier.ovalCharmCount);

            result.rewards.mysticCharmReceived = tier.mysticCharmCount;
            result.rewards.rareCandyReceived = tier.rareCandyCount;
            result.rewards.ovalCharmReceived = tier.ovalCharmCount;

            // 기초 포켓몬 지급
            if (tier.basePokemonCount > 0) {
                const basePokemon = await grantRandomPokemon(
                    client, userId, ['Base'],
                    `스크린타임 기록 (${tier.comparisonResult})`,
                    tier.basePokemonCount
                );
                result.rewards.basePokemonList = basePokemon;
            }

            // 전설/울트라비스트 포켓몬 지급
            if (tier.giveLegendary) {
                const legendaryPokemon = await grantRandomPokemon(
                    client, userId, ['Legendary', 'UltraBeast'],
                    '전설/울트라비스트 (스크린타임 보상)',
                    1, [], true // excludeForms: true
                );
                if (legendaryPokemon.length > 0) {
                    result.rewards.legendaryPokemon = legendaryPokemon[0];
                }
            }

            // 패러독스/환상 포켓몬 지급
            if (tier.giveParadoxMythical) {
                const excludeIds = result.rewards.legendaryPokemon
                    ? [result.rewards.legendaryPokemon]
                    : [];
                const mythicalPokemon = await grantRandomPokemon(
                    client, userId, ['Paradox', 'Mythical'],
                    '패러독스/환상 (스크린타임 보상)',
                    1, excludeIds, true // excludeForms: true
                );
                if (mythicalPokemon.length > 0) {
                    result.rewards.mythicalPokemon = mythicalPokemon[0];
                }
            }
        }
    } else {
        // 전주 데이터가 없는 경우 기본 보상 (기초 포켓몬 1마리)
        result.comparisonResult = '전주 데이터 없음';
        const basePokemon = await grantRandomPokemon(
            client, userId, ['Base'],
            '스크린타임 기록 (최초 또는 전주 데이터 없음)',
            1
        );
        result.rewards.basePokemonList = basePokemon;
    }

    // 공휴일 특별 보상
    if (isHoliday) {
        const specialPokemon = await grantRandomPokemon(
            client, userId, ['Paradox', 'Mythical'],
            '공휴일 보상 (패러독스/환상)',
            1, [], true // excludeForms: true
        );
        if (specialPokemon.length > 0) {
            result.rewards.specialDayPokemon = specialPokemon[0];
            result.rewards.specialDayType = 'Holiday (Paradox/Mythical)';
        }
    }

    // 토요일 빛나는부적 보상
    if (isSaturday) {
        await grantItem(client, userId, 'Shiny Charm', 1);
        result.rewards.shinyCharmReceived = 1;
    }

    // 포켓몬 데이 (2월 27일) 특별 보상
    const currentMonth = new Date().getMonth() + 1;
    const currentDay = new Date().getDate();
    if (currentMonth === 2 && currentDay === 27) {
        await grantItem(client, userId, 'Brilliance Charm', 5);
        result.rewards.brillianceCharmReceived = 5;
    }

    return result;
}

/**
 * 스크린타임 코드 파싱 (HHMM 형식)
 * @param {string|number} usageCode - 사용 코드
 * @param {boolean} isOver10Hours - 10시간 이상 여부
 * @returns {Object} { hours, minutes, error }
 */
function parseUsageCode(usageCode, isOver10Hours = false) {
    const codeStr = usageCode.toString();
    let hours, minutes;

    switch (codeStr.length) {
        case 1:
        case 2:
            hours = 0;
            minutes = parseInt(usageCode);
            break;
        case 3:
            if (isOver10Hours) {
                hours = 10;
                minutes = parseInt(codeStr.substring(1, 3));
            } else {
                hours = parseInt(codeStr.substring(0, 1));
                minutes = parseInt(codeStr.substring(1, 3));
            }
            break;
        case 4:
            hours = parseInt(codeStr.substring(0, 2));
            minutes = parseInt(codeStr.substring(2, 4));
            break;
        default:
            return { error: `Invalid usage code format: ${usageCode}. Expected 1-4 digits.` };
    }

    // 분 범위 검증
    if (minutes < 0 || minutes >= 60) {
        return { error: `Invalid minutes value: ${minutes}. Must be between 0-59.` };
    }

    // 시간 범위 검증
    if (hours > 24 || (hours === 24 && minutes > 0)) {
        return { error: `Invalid usage time: ${hours} hours ${minutes} minutes exceeds 24 hours.` };
    }

    return { hours, minutes };
}

module.exports = {
    calculateRewardTier,
    getLastWeekDates,
    grantItem,
    grantRandomPokemon,
    processScreenTimeRewards,
    parseUsageCode
};
