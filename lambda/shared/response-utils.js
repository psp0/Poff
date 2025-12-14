/**
 * HTTP 응답 생성 유틸리티
 */

const { logger } = require('./logger');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGIN || '*', // Production should set this env var
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * 성공 응답 생성
 * @param {any} data - 응답 데이터
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 * @returns {Object} Lambda 응답 객체
 */
function createSuccessResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * 오류 응답 생성
 * @param {string} message - 오류 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @param {any} details - 추가 오류 정보
 * @returns {Object} Lambda 응답 객체
 */
function createErrorResponse(message, statusCode = 500, details = null) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * CORS preflight 응답 생성
 * @returns {Object} Lambda 응답 객체
 */
function createCorsResponse() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
}

/**
 * 페이지네이션 응답 생성
 * @param {Array} data - 데이터 배열
 * @param {number} page - 현재 페이지
 * @param {number} limit - 페이지당 항목 수
 * @param {number} total - 전체 항목 수
 * @returns {Object} Lambda 응답 객체
 */
function createPaginatedResponse(data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return createSuccessResponse({
    items: data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

/**
 * 에러 핸들링 래퍼
 * @param {Function} handler - 실제 핸들러 함수
 * @returns {Function} 에러 처리가 포함된 핸들러
 */
function withErrorHandling(handler) {
  return async (event, context) => {
    // Reuse database connection across Lambda invocations
    context.callbackWaitsForEmptyEventLoop = false;

    try {
      // CORS preflight 요청 처리
      if (event.httpMethod === 'OPTIONS') {
        return createCorsResponse();
      }

      return await handler(event, context);
    } catch (error) {
      logger.error('Lambda execution error', error);

      // 특정 오류 타입별 처리
      if (error.code === 'ECONNREFUSED') {
        return createErrorResponse('Database connection failed', 503);
      }

      if (error.message && error.message.includes('JWT')) {
        return createErrorResponse('Authentication failed', 401);
      }

      if (error.message && error.message.includes('validation')) {
        return createErrorResponse('Invalid input data', 400, error.message);
      }

      return createErrorResponse('Internal server error', 500,
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') ? error.message : undefined
      );
    }
  };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createCorsResponse,
  createPaginatedResponse,
  withErrorHandling,
  corsHeaders
};