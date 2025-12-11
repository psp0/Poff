const admin = require('firebase-admin');
const db = require('./database');
const { logger } = require('./logger');
const { unauthorized, internalServerError } = require('./response');

// Initialize Firebase Admin if not already initialized
// Initialize Firebase Admin if not already initialized
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    let credential;

    // 1. 환경 변수에서 Service Account JSON 파싱 (AWS Lambda Best Practice)
    // 보안상 파일 업로드보다 환경 변수 주입이 안전하며, Secrets Manager보다 성능(Cold Start)이 우수합니다.
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        credential = admin.credential.cert(serviceAccount);
      } catch (e) {
        logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable', e);
      }
    }

    // 2. 환경 변수가 없으면 기본값 사용 (로컬 개발/GCP 환경 호환)
    if (!credential) {
      credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
      credential: credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'pokehabit-481f3'
    });
  } catch (error) {
    logger.warn('Firebase Admin initialization failed:', error);
  }
}

/**
 * Firebase ID Token 검증 미들웨어
 */
const verifyToken = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;

    if (!authHeader) {
      return { error: unauthorized('Authorization header is required') };
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      return { error: unauthorized('Token is required') };
    }

    // Firebase ID Token 검증
    const verifyStart = Date.now();
    const decodedToken = await admin.auth().verifyIdToken(token);
    logger.debug('Token verification completed', { duration: Date.now() - verifyStart });
    const firebaseUid = decodedToken.uid;

    // 사용자 정보 조회 (firebase_uid로 조회)
    const user = await db.findOne('users', { firebase_uid: firebaseUid });

    if (!user) {
      return { error: unauthorized('User not found') };
    }

    // 사용자 활성 상태 확인
    if (!user.is_active) {
      return { error: unauthorized('User account is deactivated') };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        firebase_uid: firebaseUid
      }
    };
  } catch (error) {
    logger.error('Token verification failed', error);

    if (error.code === 'auth/id-token-expired') {
      return { error: unauthorized('Token expired') };
    }

    return { error: unauthorized('Invalid token') };
  }
};

/**
 * 선택적 인증 (토큰이 있으면 검증, 없어도 통과)
 */
const optionalAuth = async (event) => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) {
    return { user: null };
  }

  return await verifyToken(event);
};

/**
 * 관리자 권한 확인
 */
const requireAdmin = (user) => {
  if (!user || user.role !== 'admin') {
    return { error: unauthorized('Admin access required') };
  }
  return { user };
};

/**
 * 사용자 소유권 확인
 */
const requireOwnership = (user, resourceUserId) => {
  if (!user) {
    return { error: unauthorized('Authentication required') };
  }

  if (user.role !== 'admin' && user.id !== resourceUserId) {
    return { error: unauthorized('Access denied') };
  }

  return { user };
};

/**
 * API 키 검증 (서버 간 통신용)
 */
const verifyApiKey = (event) => {
  const apiKey = event.headers?.['X-API-Key'] || event.headers?.['x-api-key'];

  if (!apiKey) {
    return { error: unauthorized('API key is required') };
  }

  if (apiKey !== process.env.API_KEY) {
    return { error: unauthorized('Invalid API key') };
  }

  return { valid: true };
};

/**
 * 간단한 인증 (동기식) - Lambda 함수에서 사용
 * Authorization 헤더의 Firebase Token을 검증
 */
const authenticate = async (event) => {
  // 1. Authorization 헤더 확인
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader) {
    try {
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

      // Firebase Token 검증
      const decodedToken = await admin.auth().verifyIdToken(token);
      const firebaseUid = decodedToken.uid;

      // DB에서 user_id 조회
      const user = await db.findOne('users', { firebase_uid: firebaseUid });

      if (user) {
        return {
          userId: user.id,
          isService: false,
          user: { ...user, firebase_uid: firebaseUid },
          firebaseUid,
          decodedToken
        };
      }

      // User not found in DB, but token is valid
      return {
        userId: null,
        firebaseUid,
        decodedToken
      };
    } catch (err) {
      logger.error('Token verification failed in authenticate', err);
    }
  }

  // 인증 실패 시 null 반환
  return { userId: null };
};

/**
 * 인증 및 Body 파싱
 */
const authenticateAndParseBody = async (event) => {
  const auth = await authenticate(event);
  const requestBody = JSON.parse(event.body || '{}');

  return {
    userId: auth.userId,
    requestBody,
    auth
  };
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireAdmin,
  requireOwnership,
  verifyApiKey,
  authenticate,
  authenticateAndParseBody
};