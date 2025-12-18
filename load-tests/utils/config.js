// Load Testing Configuration
export const config = {
  // Target environments
  environments: {
    dev: {
      baseUrl: __ENV.DEV_API_URL || 'https://api-dev.pokehabit.example.com',
      vus: 10,
      duration: '2m'
    },
    prod: {
      baseUrl: __ENV.PROD_API_URL || 'https://api.pokehabit.example.com',
      vus: 50,
      duration: '5m'
    }
  },
  
  // Test thresholds
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.05'], // Error rate < 5%
    http_reqs: ['rate>10'], // At least 10 requests per second
  },
  
  // Common headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

// Get environment config
export function getEnvConfig() {
  const env = __ENV.ENVIRONMENT || 'dev';
  return config.environments[env] || config.environments.dev;
}

// Authentication helper (if needed)
export function getAuthToken() {
  return __ENV.AUTH_TOKEN || '';
}

// Generate test user data
export function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `test-user-${timestamp}-${random}@example.com`,
    username: `testuser${timestamp}${random}`,
    password: 'TestPass123!'
  };
}

// Generate random Pokemon ID (assuming 1-151 for Gen 1)
export function randomPokemonId() {
  return Math.floor(Math.random() * 151) + 1;
}

// Generate random exercise data
export function generateExerciseData() {
  const exercises = ['running', 'walking', 'cycling', 'swimming', 'yoga'];
  const exercise = exercises[Math.floor(Math.random() * exercises.length)];
  return {
    type: exercise,
    duration: Math.floor(Math.random() * 60) + 10, // 10-70 minutes
    calories: Math.floor(Math.random() * 500) + 50, // 50-550 calories
    date: new Date().toISOString()
  };
}
