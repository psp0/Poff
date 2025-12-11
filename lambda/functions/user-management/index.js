const { getDatabase } = require('../../shared/database');
const { createSuccessResponse, createErrorResponse, withErrorHandling } = require('../../shared/response-utils');
const { authenticate, authenticateAndParseBody } = require('../../shared/auth');
const { logger } = require('../../shared/logger');

const handler = async (event, context) => {
    const db = getDatabase();
    const method = event.httpMethod;
    const path = event.path;

    // Add request context to logger
    logger.info('Incoming Request', { path, method, query: event.queryStringParameters });

    if (method === 'POST' && path.endsWith('/auth/sync')) {
        return await syncUserByFirebase(event, db);
    } else if (method === 'POST' && path.endsWith('/user/terms-agreement')) {
        return await saveTermsAgreement(event, db);
    } else if (method === 'POST' && path.endsWith('/user/exchange')) {
        return await exchangeItem(event, db);
    } else if (method === 'GET' && path.endsWith('/shop/items')) {
        return await getShopItems(event, db);
    } else {
        logger.warn('Route not found', { path, method });
        return createErrorResponse('Not Found', 404);
    }
};

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

module.exports = { handler: withErrorHandling(handler) };
