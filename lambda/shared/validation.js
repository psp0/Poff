const Joi = require('joi');

/**
 * 공통 검증 스키마
 */
const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }),
  username: Joi.string().alphanum().min(3).max(30).required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }
};

/**
 * 사용자 관련 검증 스키마
 */
const userSchemas = {
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    username: commonSchemas.username,
    timezone: Joi.string().max(50).default('Asia/Seoul')
  }),

  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    username: commonSchemas.username.optional(),
    timezone: Joi.string().max(50).optional(),
    avatar_url: Joi.string().uri().max(500).optional().allow(null)
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password
  })
};

/**
 * 푸시 알림 관련 검증 스키마
 */


/**
 * 운동 관련 검증 스키마
 */
const exerciseSchemas = {
  log: Joi.object({
    exercise_type: Joi.string().valid('cardio', 'strength', 'flexibility', 'sports', 'other').required(),
    duration_minutes: Joi.number().integer().min(1).max(600).required(), // 최대 10시간
    intensity: Joi.string().valid('low', 'moderate', 'high').required(),
    calories_burned: Joi.number().integer().min(0).max(2000).optional(),
    notes: Joi.string().max(500).optional().allow(''),
    exercise_date: Joi.date().max('now').required()
  }),

  update: Joi.object({
    exercise_type: Joi.string().valid('cardio', 'strength', 'flexibility', 'sports', 'other').optional(),
    duration_minutes: Joi.number().integer().min(1).max(600).optional(),
    intensity: Joi.string().valid('low', 'moderate', 'high').optional(),
    calories_burned: Joi.number().integer().min(0).max(2000).optional(),
    notes: Joi.string().max(500).optional().allow('')
  }),

  query: Joi.object({
    start_date: Joi.date().optional(),
    end_date: Joi.date().min(Joi.ref('start_date')).optional(),
    exercise_type: Joi.string().valid('cardio', 'strength', 'flexibility', 'sports', 'other').optional(),
    ...commonSchemas.pagination
  })
};

/**
 * 스크린타임 관련 검증 스키마
 */
const screenTimeSchemas = {
  log: Joi.object({
    screen_time_minutes: Joi.number().integer().min(0).max(1440).required(), // 최대 24시간
    app_usage: Joi.object().pattern(
      Joi.string(),
      Joi.number().integer().min(0)
    ).optional(),
    screen_time_date: Joi.date().max('now').required(),
    notes: Joi.string().max(500).optional().allow('')
  }),

  update: Joi.object({
    screen_time_minutes: Joi.number().integer().min(0).max(1440).optional(),
    app_usage: Joi.object().pattern(
      Joi.string(),
      Joi.number().integer().min(0)
    ).optional(),
    notes: Joi.string().max(500).optional().allow('')
  }),

  query: Joi.object({
    start_date: Joi.date().optional(),
    end_date: Joi.date().min(Joi.ref('start_date')).optional(),
    ...commonSchemas.pagination
  })
};

/**
 * 포켓몬 관련 검증 스키마
 */
const pokemonSchemas = {
  toggleFavorite: Joi.object({
    pokemon_id: Joi.number().integer().min(1).max(1010).required() // 현재 포켓몬 수
  }),

  collection: Joi.object({
    ...commonSchemas.pagination,
    is_shiny: Joi.boolean().optional(),
    is_favorite: Joi.boolean().optional(),
    sort_by: Joi.string().valid('obtained_at', 'pokemon_id', 'name').default('obtained_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  })
};

/**
 * 알림 설정 검증 스키마
 */


/**
 * 입력 검증 함수
 */
const validate = (schema, data, options = {}) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    ...options
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    return {
      isValid: false,
      errors,
      data: null
    };
  }

  return {
    isValid: true,
    errors: null,
    data: value
  };
};

/**
 * SQL 인젝션 방지를 위한 문자열 정리
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  // 기본적인 SQL 인젝션 패턴 제거
  return str
    .replace(/['"`;\\]/g, '') // 따옴표, 세미콜론, 백슬래시 제거
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi, '') // SQL 키워드 제거
    .trim();
};

/**
 * XSS 방지를 위한 HTML 이스케이프
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
};

/**
 * 이메일 형식 검증
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * UUID 형식 검증
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * 날짜 범위 검증
 */
const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return start <= end && start <= new Date();
};

/**
 * 파일 업로드 검증
 */
const validateFileUpload = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  } = options;

  const errors = [];

  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type must be one of: ${allowedTypes.join(', ')}`);
  }

  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    errors.push(`File extension must be one of: ${allowedExtensions.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  // 스키마들
  commonSchemas,
  userSchemas,
  exerciseSchemas,
  screenTimeSchemas,
  pokemonSchemas,


  // 검증 함수들
  validate,
  sanitizeString,
  escapeHtml,
  isValidEmail,
  isValidUUID,
  isValidDateRange,
  validateFileUpload
};