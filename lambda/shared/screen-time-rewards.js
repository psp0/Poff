const { logger } = require('./logger');
const { getKstDayOfWeek, getKstMonth, getKstDay, getKstDateString, sqlKstDate } = require('./timezone');

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
    let mythicalCount = 0;
    let legendaryCount = 0;
    let comparisonResult = null;

    // 실제 조건 판단: 시간대 기준 vs 감소율 기준
    // 시간대 조건이 더 우선 (더 좋은 보상을 주는 조건 기준)
    const hourBasedTier = hours <= 2 ? 1 : hours === 3 ? 2 : hours === 4 ? 3 : null;
    const percentBasedTier = changePercentage <= -40 ? 1 : changePercentage <= -30 ? 2 : changePercentage <= -20 ? 3 :
        changePercentage <= -10 ? 4 : changePercentage < 0 ? 5 :
            changePercentage < 10 ? 6 : changePercentage < 20 ? 7 :
                changePercentage < 30 ? 8 : changePercentage < 40 ? 9 : 10;

    // 더 좋은 티어를 선택 (낮은 숫자가 더 좋음)
    const effectiveTier = hourBasedTier && hourBasedTier <= percentBasedTier ? hourBasedTier : percentBasedTier;
    const usedHourCondition = hourBasedTier && hourBasedTier <= percentBasedTier;

    // 메시지 생성
    if (usedHourCondition) {
        // 시간대 기준으로 보상 받음
        if (hours <= 2) {
            comparisonResult = '2시간 이하로 사용하셨네요! 🎉';
        } else if (hours === 3) {
            comparisonResult = '3시간대로 사용하셨네요! 👍';
        } else if (hours === 4) {
            comparisonResult = '4시간대로 사용하셨네요!';
        }
    } else {
        // 감소율 기준으로 보상 받음
        if (changePercentage < 0) {
            comparisonResult = `전주대비 ${Math.abs(Math.round(changePercentage))}% 감소했어요! 🎉`;
        } else if (changePercentage === 0) {
            comparisonResult = '전주와 동일한 사용량이에요.';
        } else if (changePercentage < 40) {
            comparisonResult = `전주대비 ${Math.round(changePercentage)}% 증가했어요.`;
        } else {
            comparisonResult = `전주대비 ${Math.round(changePercentage)}% 증가 (보상 없음)`;
        }
    }

    // 보상 계산 (effectiveTier 기준)
    if (effectiveTier === 1) {
        mysticCharmCount = 5;
        rareCandyCount = 6;
        basePokemonCount = 3;
        ovalCharmCount = 2;
        mythicalCount = 2;
        legendaryCount = 1;
    } else if (effectiveTier === 2) {
        mysticCharmCount = 5;
        rareCandyCount = 6;
        basePokemonCount = 3;
        ovalCharmCount = 2;
        mythicalCount = 1;
        legendaryCount = 1;
    } else if (effectiveTier === 3) {
        mysticCharmCount = 4;
        rareCandyCount = 5;
        basePokemonCount = 3;
        ovalCharmCount = 1;
        legendaryCount = 1;
    } else if (effectiveTier === 4) {
        mysticCharmCount = 3;
        rareCandyCount = 4;
        basePokemonCount = 2;
        ovalCharmCount = 1;
    } else if (effectiveTier === 5) {
        mysticCharmCount = 2;
        rareCandyCount = 3;
        basePokemonCount = 2;
    } else if (effectiveTier === 6) {
        mysticCharmCount = 1;
        rareCandyCount = 3;
    } else if (effectiveTier === 7) {
        mysticCharmCount = 1;
        rareCandyCount = 2;
    } else if (effectiveTier === 8) {
        rareCandyCount = 2;
    } else if (effectiveTier === 9) {
        mysticCharmCount = 1;
    }
    // effectiveTier === 10: 보상 없음

    return {
        mysticCharmCount,
        rareCandyCount,
        basePokemonCount,
        ovalCharmCount,
        mythicalCount,
        legendaryCount,
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
    let remaining = count;
    let allExcluded = [...excludeIds];

    // 1. 사용자의 현재 서식지 조회
    let targetHabitat = null;
    let targetType = null;

    try {
        const habitatRes = await client.query(
            'SELECT current_habitat, current_sub_habitat FROM user_habitats WHERE user_id = ?',
            [userId]
        );

        if (habitatRes.rows.length > 0) {
            const { current_habitat, current_sub_habitat } = habitatRes.rows[0];

            // 랜덤 서식지가 아니고, 세부 서식지가 설정된 경우
            if (current_habitat !== 'random') {
                targetHabitat = current_habitat;

                // 세부 서식지가 있으면 타입까지 지정
                if (current_sub_habitat) {
                    const lastUnderscoreIndex = current_sub_habitat.lastIndexOf('_');
                    if (lastUnderscoreIndex !== -1) {
                        // habitat 부분이 일치하는지 확인 (안전장치)
                        const subHabitatPrefix = current_sub_habitat.substring(0, lastUnderscoreIndex);
                        if (subHabitatPrefix === current_habitat) {
                            targetType = current_sub_habitat.substring(lastUnderscoreIndex + 1);
                        }
                    }
                }
            }
        }
    } catch (err) {
        logger.warn('Failed to fetch user habitat in grantRandomPokemon', err);
        // 오류 발생 시 랜덤으로 진행
    }

    // flag_name으로 직접 조회 (pokemon_flag_relations 테이블은 flag_name을 사용)
    const flagPlaceholders = flagNames.map(() => '?').join(', ');

    // 폼 제외 조건
    const formExcludeCondition = excludeForms
        ? "AND p.stable_id NOT REGEXP '_[0-9]+$'"
        : '';

    // 2. 서식지 타겟팅 시도 (targetHabitat이 있을 경우)
    // Case A: Habitat + Type 둘 다 있는 경우 (세부 서식지) (우선순위 1)
    if (targetHabitat && targetType && remaining > 0) {

        const excludePlaceholders = allExcluded.length > 0
            ? `AND p.stable_id NOT IN (${allExcluded.map(() => '?').join(', ')})`
            : '';

        const habitatQueryParams = [
            ...flagNames,
            targetHabitat,
            targetType, targetType,
            userId,
            ...(allExcluded.length > 0 ? allExcluded : []),
            remaining
        ];

        const habitatQuery = `
            SELECT 
                p.stable_id, p.name, p.image_name, p.form_suffix, 
                p.asset_source, p.has_icon, p.has_icon_shiny
            FROM pokemon p
            INNER JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
            WHERE pfr.flag_name IN (${flagPlaceholders})
              AND p.habitat_en = ?
              AND (p.type1_en = ? OR p.type2_en = ?)
              AND NOT EXISTS (
                SELECT 1 FROM user_pokemon_collection
                WHERE user_id = ? AND pokemon_stable_id = p.stable_id
              )
              ${excludePlaceholders}
              ${formExcludeCondition}
            ORDER BY RAND()
            LIMIT ?
        `;

        const habitatResult = await client.query(habitatQuery, habitatQueryParams);

        for (const pokemonData of habitatResult.rows) {
            await client.query(`
                INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, obtained_reason)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE obtained_reason = obtained_reason
            `, [userId, pokemonData.stable_id, reason]);

            grantedPokemon.push({
                ...pokemonData,
                obtained_reason: reason
            });
        }

        remaining -= habitatResult.rows.length;
        allExcluded.push(...habitatResult.rows.map(p => p.stable_id));

        if (habitatResult.rows.length > 0) {
            logger.info(`Granted ${habitatResult.rows.length} pokemon from habitat ${targetHabitat}/${targetType}`);
        }
    }

    // Case B: Habitat만 있는 경우 (세부 서식지 파싱 실패 혹은 미설정 시 fallback) (우선순위 2)
    if (targetHabitat && remaining > 0) {

        const excludePlaceholders = allExcluded.length > 0
            ? `AND p.stable_id NOT IN (${allExcluded.map(() => '?').join(', ')})`
            : '';

        const habitatOnlyQueryParams = [
            ...flagNames,
            targetHabitat,
            userId,
            ...(allExcluded.length > 0 ? allExcluded : []),
            remaining
        ];

        const habitatOnlyQuery = `
            SELECT 
                p.stable_id, p.name, p.image_name, p.form_suffix, 
                p.asset_source, p.has_icon, p.has_icon_shiny
            FROM pokemon p
            INNER JOIN pokemon_flag_relations pfr ON p.stable_id = pfr.pokemon_stable_id
            WHERE pfr.flag_name IN (${flagPlaceholders})
              AND p.habitat_en = ?
              AND NOT EXISTS (
                SELECT 1 FROM user_pokemon_collection
                WHERE user_id = ? AND pokemon_stable_id = p.stable_id
              )
              ${excludePlaceholders}
              ${formExcludeCondition}
            ORDER BY RAND()
            LIMIT ?
        `;

        const habitatOnlyResult = await client.query(habitatOnlyQuery, habitatOnlyQueryParams);

        for (const pokemonData of habitatOnlyResult.rows) {
            await client.query(`
                INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, obtained_reason)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE obtained_reason = obtained_reason
            `, [userId, pokemonData.stable_id, reason]);

            grantedPokemon.push({
                ...pokemonData,
                obtained_reason: reason
            });
        }

        remaining -= habitatOnlyResult.rows.length;
        allExcluded.push(...habitatOnlyResult.rows.map(p => p.stable_id));

        if (habitatOnlyResult.rows.length > 0) {
            logger.info(`Granted ${habitatOnlyResult.rows.length} pokemon from general habitat ${targetHabitat}`);
        }
    }

    // 3. 서식지 타겟팅 실패 시 (또는 설정 안된 경우) 글로벌 랜덤 시도 (최종 fallback)
    if (remaining > 0) {

        const excludePlaceholders = allExcluded.length > 0
            ? `AND p.stable_id NOT IN (${allExcluded.map(() => '?').join(', ')})`
            : '';

        const globalQueryParams = [
            ...flagNames,
            userId,
            ...(allExcluded.length > 0 ? allExcluded : []),
            remaining
        ];

        const globalQuery = `
            SELECT 
                p.stable_id, p.name, p.image_name, p.form_suffix, 
                p.asset_source, p.has_icon, p.has_icon_shiny
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
            LIMIT ?
        `;

        const globalResult = await client.query(globalQuery, globalQueryParams);

        for (const pokemonData of globalResult.rows) {
            await client.query(`
                INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, obtained_reason)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE obtained_reason = obtained_reason
            `, [userId, pokemonData.stable_id, reason]);

            grantedPokemon.push({
                ...pokemonData,
                obtained_reason: reason
            });
        }

        if (globalResult.rows.length > 0) {
            logger.info(`Granted ${globalResult.rows.length} random pokemon (fallback)`);
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
            // New unified structures
            pokemons: [],
            items: [],

            // Legacy/Deprecated fields (kept for specific logic check but frontend should use above)
            mysticCharmReceived: 0,
            rareCandyReceived: 0,
            ovalCharmReceived: 0,
            shinyCharmReceived: 0,
            brillianceCharmReceived: 0
        }
    };

    // 새로운 기록이 아니면 보상 없음
    if (!isNewEntry) {
        return result;
    }

    const usageMinutes = hours * 60 + minutes;

    // 공휴일 및 절기 확인
    // KST 기준 날짜로 조회 (UTC 환경에서도 일관된 결과)
    const kstDateStr = getKstDateString();
    const dateInfoResult = await client.query(
        'SELECT type, is_holiday, name FROM date_info WHERE date = ?',
        [kstDateStr]
    );
    const isHoliday = dateInfoResult.rows.some(r => r.is_holiday);
    const isSolarTerm = dateInfoResult.rows.some(r => r.type === 'solar_term');
    const eventName = dateInfoResult.rows.length > 0 ? dateInfoResult.rows[0].name : null;

    // 토요일 여부 확인 (KST 기준)
    const dayOfWeek = getKstDayOfWeek();
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

            // 아이템 지급 및 기록
            await grantItem(client, userId, 'Mystic Charm', tier.mysticCharmCount);
            if (tier.mysticCharmCount > 0) {
                result.rewards.items.push({ name: 'Mystic Charm', nameKr: '신비의 부적', count: tier.mysticCharmCount });
                result.rewards.mysticCharmReceived = tier.mysticCharmCount;
            }

            await grantItem(client, userId, 'Rare Candy', tier.rareCandyCount);
            if (tier.rareCandyCount > 0) {
                result.rewards.items.push({ name: 'Rare Candy', nameKr: '이상한 사탕', count: tier.rareCandyCount });
                result.rewards.rareCandyReceived = tier.rareCandyCount;
            }

            await grantItem(client, userId, 'Oval Charm', tier.ovalCharmCount);
            if (tier.ovalCharmCount > 0) {
                result.rewards.items.push({ name: 'Oval Charm', nameKr: '둥근부적', count: tier.ovalCharmCount });
                result.rewards.ovalCharmReceived = tier.ovalCharmCount;
            }

            // 기초 포켓몬 지급
            if (tier.basePokemonCount > 0) {
                const basePokemon = await grantRandomPokemon(
                    client, userId, ['Base'],
                    `스크린타임 기록 (${tier.comparisonResult})`,
                    tier.basePokemonCount
                );
                result.rewards.pokemons.push(...basePokemon);
            }

            // 전설 포켓몬 지급 (Screen Time Reward: Legendary)
            // -20%, -30%, -40% tier now gives Legendary
            if (tier.legendaryCount > 0) {
                // 이미 받은 포켓몬 제외
                const excludeIds = result.rewards.pokemons.map(p => p.stable_id);

                const legendaryPokemonList = await grantRandomPokemon(
                    client, userId, ['Legendary'],
                    '전설 (스크린타임 보상)',
                    tier.legendaryCount, excludeIds, true // excludeForms: true
                );

                result.rewards.pokemons.push(...legendaryPokemonList);
            }

            // 환상 포켓몬 지급 (Screen Time Reward: Mythical)
            // -30%, -40% tier now gives Mythical
            if (tier.mythicalCount > 0) {
                // 이미 받은 포켓몬 제외
                const excludeIds = result.rewards.pokemons.map(p => p.stable_id);

                const mythicalPokemonList = await grantRandomPokemon(
                    client, userId, ['Mythical'],
                    '환상 (스크린타임 보상)',
                    tier.mythicalCount, excludeIds, true // excludeForms: true
                );

                result.rewards.pokemons.push(...mythicalPokemonList);
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
        result.rewards.pokemons.push(...basePokemon);
    }

    // 공휴일 특별 보상 -> 전설 (Legendary)
    if (isHoliday) {
        // 이미 받은 포켓몬 제외
        const excludeIds = result.rewards.pokemons.map(p => p.stable_id);

        const holidayPokemon = await grantRandomPokemon(
            client, userId, ['Legendary'],
            '공휴일 보상 (전설)',
            1, excludeIds, true // excludeForms: true
        );

        result.rewards.pokemons.push(...holidayPokemon);
    }

    // 24절기 보상 -> 울트라비스트 or 패러독스 (UltraBeast | Paradox)
    if (isSolarTerm) {
        // 이미 받은 포켓몬 제외
        const excludeIds = result.rewards.pokemons.map(p => p.stable_id);

        const solarPokemon = await grantRandomPokemon(
            client, userId, ['UltraBeast', 'Paradox'],
            '24절기 보상 (울트라비스트/패러독스)',
            1, excludeIds, true // excludeForms: true
        );

        result.rewards.pokemons.push(...solarPokemon);
    }

    // 토요일 빛나는부적 보상
    if (isSaturday) {
        await grantItem(client, userId, 'Shiny Charm', 1);
        result.rewards.items.push({ name: 'Shiny Charm', nameKr: '빛나는부적', count: 1 });
        result.rewards.shinyCharmReceived = 1;
    }

    // 포켓몬 데이 (2월 27일) 특별 보상 (KST 기준)
    const currentMonth = getKstMonth();
    const currentDay = getKstDay();
    if (currentMonth === 2 && currentDay === 27) {
        await grantItem(client, userId, 'Brilliance Charm', 5);
        result.rewards.items.push({ name: 'Brilliance Charm', nameKr: '광휘의 부적', count: 5 });
        result.rewards.brillianceCharmReceived = 5;
    }

    // 이벤트 이름 추가 (공휴일 또는 절기가 있을 경우)
    if (eventName) {
        result.eventName = eventName;
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
