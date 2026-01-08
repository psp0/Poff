const { getDatabase } = require('../../shared/database');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { authenticate, authenticateAndParseBody } = require('../../shared/auth');
const { logger } = require('../../shared/logger');

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

    // Add request context to logger
    logger.info('Incoming Request', { path, method, query: event.queryStringParameters });

    if (method === 'POST' && routePath.endsWith('/auth/sync')) {
        return await syncUserByFirebase(event, db);
    } else if (method === 'POST' && routePath.endsWith('/user/terms-agreement')) {
        return await saveTermsAgreement(event, db);
    } else if (method === 'POST' && routePath.endsWith('/user/exchange')) {
        return await exchangeItem(event, db);
    } else if (method === 'GET' && routePath.endsWith('/shop/items')) {
        return await getShopItems(event, db);
    } else if (method === 'GET' && routePath.endsWith('/api/config')) {
        return getConfig(event);
    } else if (method === 'GET' && routePath.endsWith('/user/habitat')) {
        return await getUserHabitat(event, db);
    } else if (method === 'POST' && routePath.endsWith('/user/habitat')) {
        return await updateUserHabitat(event, db);
    } else if (method === 'GET' && routePath.endsWith('/habitats')) {
        return await getHabitats(event, db);
    } else {
        logger.warn('Route not found', { path, method });
        return createErrorResponse('Not Found', 404);
    }
};

function getConfig(event) {
    return createSuccessResponse({
        firebase: {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        }
    });
}

async function syncUserByFirebase(event, db) {
    const start = Date.now();
    const body = JSON.parse(event.body || '{}');
    const { email, username } = body;

    // Verify token using shared auth
    const authResult = await authenticate(event);
    logger.info(`Authentication took ${Date.now() - start}ms`);

    if (!authResult || !authResult.firebaseUid) {
        logger.warn('Authentication failed during sync', { emailHash: require('crypto').createHash('sha256').update(email).digest('hex') });
        return createErrorResponse('Invalid Firebase ID Token', 401);
    }

    const { firebaseUid: firebase_uid, decodedToken, user: authUser } = authResult;
    const tokenEmail = decodedToken.email || email;

    try {
        let userId;
        let isNewUser = false;

        if (authUser) {
            // User exists - use data from authResult
            userId = authUser.id;

            // Update login time
            await db.query(
                'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = ?',
                [userId]
            );

            isNewUser = !authUser.terms_agreed_at;
            logger.info('User synced (existing)', { userId, firebase_uid });
        } else {
            isNewUser = true;

            // Transaction for new user creation to ensure consistency
            userId = await db.transaction(async (client) => {
                // First check if email exists without firebase_uid (legacy account)
                const emailCheck = await client.query(
                    'SELECT id FROM users WHERE email = ? AND firebase_uid IS NULL',
                    [email]
                );

                let newUserId;

                if (emailCheck.rows.length > 0) {
                    // Link existing account
                    newUserId = emailCheck.rows[0].id;
                    await client.query(
                        'UPDATE users SET firebase_uid = ?, last_login = NOW(), updated_at = NOW() WHERE id = ?',
                        [firebase_uid, newUserId]
                    );
                    logger.info('User linked (legacy)', { userId: newUserId, emailHash: require('crypto').createHash('sha256').update(email).digest('hex') });
                } else {
                    // Create brand new user
                    await client.query(
                        `INSERT INTO users (email, password_hash, username, firebase_uid, is_active, last_login)
                        VALUES (?, 'firebase_auth_placeholder', ?, ?, true, NOW())`,
                        [email, username || email.split('@')[0], firebase_uid]
                    );

                    const newUser = await client.query(
                        'SELECT id FROM users WHERE firebase_uid = ?',
                        [firebase_uid]
                    );
                    newUserId = newUser.rows[0].id;

                    // 신규 사용자에게 기본 아이템 지급
                    await client.query(
                        `INSERT INTO user_items (user_id, item_id, quantity)
                        SELECT ?, i.item_id, 5000
                        FROM items i
                        WHERE i.name IN ('Rare Candy', 'Oval Charm', 'Shiny Charm', 'Mystic Charm')`,
                        [newUserId]
                    );

                    await client.query(
                        `INSERT INTO user_items (user_id, item_id, quantity)
                        SELECT ?, i.item_id, 1000
                        FROM items i
                        WHERE i.name IN ('Brilliance Charm', 'Awakening Charm')`,
                        [newUserId]
                    );

                    // 신규 사용자에게 초기 포켓몬 지급
                    await client.query(
                        `INSERT INTO user_pokemon_collection (user_id, pokemon_stable_id, is_shiny, obtained_reason)
                        VALUES 
                            (?, 'EEVEE', false, '신규 사용자 기본 포켓몬'),
                            (?, 'PICHU', false, '신규 사용자 기본 포켓몬'),
                            (?, 'DRATINI', false, '신규 사용자 기본 포켓몬'),
                            (?, 'RALTS', false, '신규 사용자 기본 포켓몬'),
                            (?, 'GIRATINA', false, '신규 사용자 기본 포켓몬'),
                            (?, 'DEERLING', false, '신규 사용자 기본 포켓몬'),
                            (?, 'FROAKIE', false, '신규 사용자 기본 포켓몬'),
                            (?, 'ZERAORA', false, '신규 사용자 기본 포켓몬'),
                            (?, 'KUBFU', false, '신규 사용자 기본 포켓몬'),
                            (?, 'SPRIGATITO', false, '신규 사용자 기본 포켓몬')`,
                        [newUserId, newUserId, newUserId, newUserId, newUserId, newUserId, newUserId, newUserId, newUserId, newUserId]
                    );

                    logger.info('User created (new)', { userId: newUserId, emailHash: require('crypto').createHash('sha256').update(email).digest('hex') });
                }
                return newUserId;
            });
        }

        logger.info(`Total sync operation took ${Date.now() - start}ms`);

        return createSuccessResponse({
            userId: userId,
            isNewUser: isNewUser
        });
    } catch (error) {
        logger.error('Error syncing user', error);
        throw error;
    }
}

async function saveTermsAgreement(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);
    const { agreed, initialScreenTimeMinutes } = requestBody;

    if (!userId) {
        return createErrorResponse('User ID is required', 400);
    }

    try {
        if (agreed) {
            // 약관 동의 저장
            await db.query(
                'UPDATE users SET terms_agreed_at = NOW(), updated_at = NOW() WHERE id = ?',
                [userId]
            );

            // 초기 스크린타임이 제공된 경우 screen_time_weekly_stats에 지난주 데이터로 삽입
            if (initialScreenTimeMinutes !== undefined && initialScreenTimeMinutes !== null) {
                const minutes = parseInt(initialScreenTimeMinutes, 10);
                if (!isNaN(minutes) && minutes >= 0 && minutes <= 1440) {
                    // 지난주 날짜 계산 (오늘 기준 지난주 일요일~토요일)
                    const today = new Date();
                    const dayOfWeek = today.getDay(); // 0=일요일

                    // 이번 주 일요일 (이번 주 시작일)
                    const thisSunday = new Date(today);
                    thisSunday.setDate(today.getDate() - dayOfWeek);

                    // 지난주 일요일 (지난주 시작일)
                    const lastSunday = new Date(thisSunday);
                    lastSunday.setDate(thisSunday.getDate() - 7);

                    // 지난주 토요일 (지난주 마지막 날)
                    const lastSaturday = new Date(lastSunday);
                    lastSaturday.setDate(lastSunday.getDate() + 6);

                    const weekStartDate = lastSunday.toISOString().split('T')[0];
                    const weekEndDate = lastSaturday.toISOString().split('T')[0];

                    // screen_time_weekly_stats에 삽입 (사용자가 입력한 분을 avg_daily_minutes로 사용)
                    // total_days_logged는 7일로 설정 (사용자가 지난주 평균을 입력했다고 가정)
                    await db.query(
                        `INSERT INTO screen_time_weekly_stats 
                         (user_id, week_start_date, week_end_date, avg_daily_minutes, total_days_logged, total_minutes)
                         VALUES (?, ?, ?, ?, 7, ?)
                         ON DUPLICATE KEY UPDATE 
                            avg_daily_minutes = VALUES(avg_daily_minutes),
                            total_days_logged = VALUES(total_days_logged),
                            total_minutes = VALUES(total_minutes),
                            updated_at = NOW()`,
                        [userId, weekStartDate, weekEndDate, minutes, minutes * 7]
                    );

                    logger.info('Terms agreed with initial screen time saved to weekly stats', {
                        userId,
                        initialScreenTimeMinutes: minutes,
                        weekStartDate,
                        weekEndDate
                    });
                } else {
                    logger.info('Terms agreed (invalid screen time ignored)', { userId });
                }
            } else {
                logger.info('Terms agreed', { userId });
            }
        }

        return createSuccessResponse({ success: true });
    } catch (error) {
        logger.error('Error saving terms agreement', error);
        throw error;
    }
}

async function exchangeItem(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);
    const { costItemName, costAmount, rewardItemName, rewardAmount } = requestBody;

    if (!userId || !costItemName || !costAmount || !rewardItemName || !rewardAmount) {
        return createErrorResponse('Missing required fields', 400);
    }

    try {
        // Use transaction wrapper for safety
        return await db.transaction(async (client) => {
            // 1. Validate Items Existence First (Read-only)
            const costItemRes = await client.query('SELECT item_id FROM items WHERE name = ?', [costItemName]);
            if (costItemRes.rows.length === 0) {
                logger.warn('Exchange failed: Cost item not found', { costItemName });
                return createErrorResponse(`Item not found: ${costItemName}`, 404);
            }
            const costItemId = costItemRes.rows[0].item_id;

            const rewardItemRes = await client.query('SELECT item_id FROM items WHERE name = ?', [rewardItemName]);
            if (rewardItemRes.rows.length === 0) {
                logger.warn('Exchange failed: Reward item not found', { rewardItemName });
                return createErrorResponse(`Item not found: ${rewardItemName}`, 404);
            }
            const rewardItemId = rewardItemRes.rows[0].item_id;

            // 2. Check User Balance
            const userItemRes = await client.query(
                'SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?',
                [userId, costItemId]
            );

            if (userItemRes.rows.length === 0 || userItemRes.rows[0].quantity < costAmount) {
                logger.warn('Exchange failed: Insufficient balance', { userId, costItemName, current: userItemRes.rows[0]?.quantity, required: costAmount });
                return createErrorResponse(`Not enough ${costItemName}`, 400);
            }

            // 3. Execute Exchange (Writes)
            // Deduct cost
            await client.query(
                'UPDATE user_items SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?',
                [costAmount, userId, costItemId]
            );

            // Add reward
            const userRewardItemRes = await client.query(
                'SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?',
                [userId, rewardItemId]
            );

            if (userRewardItemRes.rows.length > 0) {
                await client.query(
                    'UPDATE user_items SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
                    [rewardAmount, userId, rewardItemId]
                );
            } else {
                await client.query(
                    'INSERT INTO user_items (user_id, item_id, quantity) VALUES (?, ?, ?)',
                    [userId, rewardItemId, rewardAmount]
                );
            }

            logger.info('Item exchanged successfully', { userId, costItemName, costAmount, rewardItemName, rewardAmount });

            return createSuccessResponse({
                success: true,
                message: `Exchanged ${costAmount} ${costItemName} for ${rewardAmount} ${rewardItemName}`
            });
        });

    } catch (error) {
        logger.error('Exchange error', error);
        throw error;
    }
}

async function getShopItems(event, db) {
    try {
        const result = await db.query('SELECT * FROM items');
        return createSuccessResponse(result.rows);
    } catch (error) {
        logger.error('Error fetching shop items', error);
        throw error;
    }
}

/**
 * 사용자 현재 서식지 조회
 */
async function getUserHabitat(event, db) {
    const auth = await authenticate(event);
    const userId = auth.userId;

    if (!userId) {
        return createErrorResponse('User ID is required', 400);
    }

    try {
        // user_habitats 테이블에서 조회 (없으면 기본값 'random' 반환)
        const result = await db.query(
            'SELECT current_habitat, current_sub_habitat, last_habitat_change_at FROM user_habitats WHERE user_id = ?',
            [userId]
        );

        let habitatData = {
            current_habitat: 'random',
            current_sub_habitat: null,
            last_habitat_change_at: null
        };

        if (result.rows.length > 0) {
            habitatData = result.rows[0];
        } else {
            // 레코드가 없으면 생성 (마이그레이션에서 처리했지만 안전장치)
            await db.query(
                "INSERT IGNORE INTO user_habitats (user_id, current_habitat) VALUES (?, 'random')",
                [userId]
            );
        }

        // 오늘 대분류 이동 가능 여부 확인 (04:00 기준)
        const canChangeHabitat = checkCanChangeHabitat(habitatData.last_habitat_change_at);

        return createSuccessResponse({
            ...habitatData,
            can_change_habitat: canChangeHabitat
        });
    } catch (error) {
        logger.error('Error fetching user habitat', error);
        return createErrorResponse('Failed to fetch user habitat', 500);
    }
}

/**
 * 사용자 서식지 이동
 */
async function updateUserHabitat(event, db) {
    const { userId, requestBody } = await authenticateAndParseBody(event);
    const { habitat, subHabitat } = requestBody;

    if (!userId) {
        return createErrorResponse('User ID is required', 400);
    }

    if (!habitat) {
        return createErrorResponse('Habitat is required', 400);
    }

    try {
        return await db.transaction(async (client) => {
            // 현재 상태 조회
            const currentRes = await client.query(
                'SELECT current_habitat, last_habitat_change_at FROM user_habitats WHERE user_id = ? FOR UPDATE',
                [userId]
            );

            let currentHabitat = 'random';
            let lastChange = null;
            let recordExists = false;

            if (currentRes.rows.length > 0) {
                currentHabitat = currentRes.rows[0].current_habitat;
                lastChange = currentRes.rows[0].last_habitat_change_at;
                recordExists = true;
            }

            // 대분류 변경 여부 확인
            const isHabitatChange = habitat !== currentHabitat;

            // 대분류 변경 시 제한 확인
            if (isHabitatChange) {
                // 'random'을 제외한 일반 서식지 간 이동은 하루 1회 제한 (04:00 기준)
                // 단, 'random'으로의 이동이나 'random'에서의 이동은 정책에 따라 다를 수 있음
                // 요청사항: "사용자가 하루에 한번 큰 카테고리 서식지... 이동할수 있고"

                const canChange = checkCanChangeHabitat(lastChange);
                if (!canChange) {
                    return createErrorResponse('하루에 한 번만 서식지를 이동할 수 있습니다. (매일 새벽 4시 초기화)', 403);
                }
            }

            // 업데이트 쿼리 구성
            let updateQuery = 'UPDATE user_habitats SET current_habitat = ?, current_sub_habitat = ?, updated_at = NOW()';
            const params = [habitat, subHabitat || null];

            if (isHabitatChange) {
                updateQuery += ', last_habitat_change_at = NOW()';
            }

            if (recordExists) {
                updateQuery += ' WHERE user_id = ?';
                params.push(userId);
                await client.query(updateQuery, params);
            } else {
                await client.query(
                    `INSERT INTO user_habitats (user_id, current_habitat, current_sub_habitat, last_habitat_change_at)
                     VALUES (?, ?, ?, ${isHabitatChange ? 'NOW()' : 'NULL'})`,
                    [userId, habitat, subHabitat || null]
                );
            }

            return createSuccessResponse({
                success: true,
                message: '서식지가 변경되었습니다.',
                current_habitat: habitat,
                current_sub_habitat: subHabitat
            });
        });
    } catch (error) {
        logger.error('Error updating user habitat', error);
        return createErrorResponse('Failed to update user habitat', 500);
    }
}

/**
 * 04:00 기준 서식지 이동 가능 여부 체크
 */
function checkCanChangeHabitat(lastChangeAt) {
    if (!lastChangeAt) return true;

    const lastChange = new Date(lastChangeAt);
    const now = new Date();

    // 오늘 새벽 4시 구하기
    const today4am = new Date(now);
    today4am.setHours(4, 0, 0, 0);

    // 현재 시간이 04:00 이전이면, 기준은 어제 04:00
    if (now < today4am) {
        today4am.setDate(today4am.getDate() - 1);
    }

    // 마지막 변경이 기준 시간(오늘/어제 04:00)보다 이전이면 변경 가능
    return lastChange < today4am;
}

/**
 * 전체 서식지 정보 조회
 */
async function getHabitats(event, db) {
    try {
        // habitat_backgrounds 테이블에서 모든 서식지 정보 조회
        const result = await db.query('SELECT * FROM habitat_backgrounds ORDER BY habitat_slug, type_slug');

        // 구조화된 데이터로 변환
        const habitats = {};

        result.rows.forEach(row => {
            if (!habitats[row.habitat_slug]) {
                habitats[row.habitat_slug] = {
                    slug: row.habitat_slug,
                    name: getHabitatName(row.habitat_slug), // 한글 이름 매핑
                    backgrounds: []
                };
            }

            habitats[row.habitat_slug].backgrounds.push({
                type: row.type_slug,
                display_name: row.display_name,
                image: row.image_filename
            });
        });

        return createSuccessResponse(Object.values(habitats));
    } catch (error) {
        logger.error('Error fetching habitats', error);
        return createErrorResponse('Failed to fetch habitats', 500);
    }
}

function getHabitatName(slug) {
    const map = {
        'grassland': '초원',
        'forest': '숲',
        'watersedge': '물가',
        'sea': '바다',
        'cave': '동굴',
        'mountain': '산',
        'roughterrain': '험지',
        'urban': '도시',
        'random': '랜덤'
    };
    return map[slug] || slug;
}

module.exports = { handler: withErrorHandling(handler) };
