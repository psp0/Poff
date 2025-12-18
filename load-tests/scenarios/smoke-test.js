/**
 * Smoke Test
 * 
 * Purpose: Verify that the system can handle minimal load
 * VUs: 1-5 users
 * Duration: 1-2 minutes
 * Use case: Quick validation after deployment
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getEnvConfig, randomPokemonId } from '../utils/config.js';

const envConfig = getEnvConfig();

export const options = {
  stages: [
    { duration: '30s', target: 2 },  // Ramp up to 2 users
    { duration: '1m', target: 2 },   // Stay at 2 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};

export default function () {
  const baseUrl = envConfig.baseUrl;
  
  // Test 1: Health check endpoint
  const healthCheck = http.get(`${baseUrl}/health`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
    'health check has correct response': (r) => r.json('status') === 'healthy',
  });
  
  sleep(1);
  
  // Test 2: Get Pokemon list (guest mode)
  const pokemonList = http.get(`${baseUrl}/api/pokemon`);
  check(pokemonList, {
    'pokemon list status is 200': (r) => r.status === 200,
    'pokemon list returns array': (r) => Array.isArray(r.json()),
    'pokemon list response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
  
  // Test 3: Get specific Pokemon details
  const pokemonId = randomPokemonId();
  const pokemonDetail = http.get(`${baseUrl}/api/pokemon/${pokemonId}`);
  check(pokemonDetail, {
    'pokemon detail status is 200 or 404': (r) => [200, 404].includes(r.status),
    'pokemon detail response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(2);
}

export function handleSummary(data) {
  return {
    'results/smoke-test-summary.json': JSON.stringify(data, null, 2),
  };
}

