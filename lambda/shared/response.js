/**
 * HTTP 응답 생성 유틸리티
 */

const createResponse = (statusCode, body, headers = {}) => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers
  };

  return {
    statusCode,
    headers: defaultHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
};

const success = (data, message = 'Success') => {
  return createResponse(200, {
    success: true,
    message,
    data
  });
};

const created = (data, message = 'Created successfully') => {
  return createResponse(201, {
    success: true,
    message,
    data
  });
};

const noContent = () => {
  return createResponse(204, '');
};

const badRequest = (message = 'Bad request', errors = null) => {
  return createResponse(400, {
    success: false,
    message,
    errors
  });
};

const unauthorized = (message = 'Unauthorized') => {
  return createResponse(401, {
    success: false,
    message
  });
};

const forbidden = (message = 'Forbidden') => {
  return createResponse(403, {
    success: false,
    message
  });
};

const notFound = (message = 'Not found') => {
  return createResponse(404, {
    success: false,
    message
  });
};

const conflict = (message = 'Conflict') => {
  return createResponse(409, {
    success: false,
    message
  });
};

const unprocessableEntity = (message = 'Unprocessable entity', errors = null) => {
  return createResponse(422, {
    success: false,
    message,
    errors
  });
};

const internalServerError = (message = 'Internal server error', error = null) => {
  const response = {
    success: false,
    message
  };

  // 개발 환경에서만 에러 스택 포함
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = {
      message: error.message,
      stack: error.stack
    };
  }

  return createResponse(500, response);
};

const serviceUnavailable = (message = 'Service unavailable') => {
  return createResponse(503, {
    success: false,
    message
  });
};

// CORS preflight 요청 처리
const corsResponse = () => {
  return createResponse(200, '', {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
};

// 페이지네이션 응답
const paginated = (data, pagination, message = 'Success') => {
  return createResponse(200, {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10))
    }
  });
};

module.exports = {
  createResponse,
  success,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessableEntity,
  internalServerError,
  serviceUnavailable,
  corsResponse,
  paginated
};