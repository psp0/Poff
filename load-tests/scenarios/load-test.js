/**
 * Load Test
 * 
 * Purpose: Test system performance under normal expected load
 * VUs: 10-50 users
 * Duration: 5-10 minutes
 * Use case: Validate system can handle typical daily traffic
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getEnvConfig, randomPokemonId, generateExerciseData } from '../utils/config.js';

const envConfig = getEnvConfig();
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 20 },  // Ramp up to 20 users
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // 95% < 800ms, 99% < 1.5s
    http_req_failed: ['rate<0.05'],                  // Error rate < 5%
    errors: ['rate<0.1'],                            // Custom error rate < 10%
    http_reqs: ['rate>20'],                          // At least 20 req/s
  },
};

export default function () {
  const baseUrl = envConfig.baseUrl;
  
  // Scenario 1: Browse Pokemon (60% of users)
  if (Math.random() < 0.6) {
    browsePokemonScenario(baseUrl);
  }
  // Scenario 2: User activity (30% of users)
  else if (Math.random() < 0.9) {
    userActivityScenario(baseUrl);
  }
  // Scenario 3: Heavy data operations (10% of users)
  else {
    heavyDataScenario(baseUrl);
  }
  
  sleep(Math.random() * 3 + 2); // Random sleep between 2-5 seconds
}

function browsePokemonScenario(baseUrl) {
  // Get Pokemon list
  let res = http.get(`${baseUrl}/api/pokemon`);
  const listSuccess = check(res, {
    'pokemon list status is 200': (r) => r.status === 200,
  });
  errorRate.add(!listSuccess);
  
  sleep(1);
  
  // Get random Pokemon details
  for (let i = 0; i < 3; i++) {
    const pokemonId = randomPokemonId();
    res = http.get(`${baseUrl}/api/pokemon/${pokemonId}`);
    const detailSuccess = check(res, {
      'pokemon detail loaded': (r) => [200, 404].includes(r.status),
    });
    errorRate.add(!detailSuccess);
    sleep(0.5);
  }
}

function userActivityScenario(baseUrl) {
  // Check user collection (guest mode or authenticated)
  let res = http.get(`${baseUrl}/api/user/collection`);
  check(res, {
    'user collection loaded': (r) => [200, 401].includes(r.status),
  });
  
  sleep(1);
  
  // Check user eggs
  res = http.get(`${baseUrl}/api/user/eggs`);
  check(res, {
    'user eggs loaded': (r) => [200, 401].includes(r.status),
  });
  
  sleep(1);
  
  // Log exercise activity (guest mode)
  const exerciseData = generateExerciseData();
  res = http.post(
    `${baseUrl}/api/exercises`,
    JSON.stringify(exerciseData),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, {
    'exercise logged': (r) => [200, 201, 401].includes(r.status),
  });
}

function heavyDataScenario(baseUrl) {
  // Get rewards history
  let res = http.get(`${baseUrl}/api/rewards/history`);
  check(res, {
    'rewards history loaded': (r) => [200, 401].includes(r.status),
  });
  
  sleep(1);
  
  // Get statistics
  res = http.get(`${baseUrl}/api/statistics`);
  check(res, {
    'statistics loaded': (r) => [200, 401].includes(r.status),
  });
  
  sleep(1);
  
  // Get all user data
  res = http.get(`${baseUrl}/api/user/data`);
  check(res, {
    'user data loaded': (r) => [200, 401].includes(r.status),
  });
}

export function handleSummary(data) {
  const summary = {
    'results/load-test-summary.json': JSON.stringify(data, null, 2),
    'results/load-test-summary.html': generateHtmlReport(data),
  };
  
  console.log('\n=== Load Test Summary ===');
  console.log(`Duration: ${data.state.testRunDurationMs / 1000}s`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed.values.passes}`);
  console.log(`Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  console.log(`Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`p95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`p99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  
  return summary;
}

function generateHtmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .metric { margin: 10px 0; }
    .metric-name { font-weight: bold; }
    .success { color: green; }
    .warning { color: orange; }
    .error { color: red; }
  </style>
</head>
<body>
  <h1>Load Test Report</h1>
  <div class="metric">
    <span class="metric-name">Test Duration:</span> ${data.state.testRunDurationMs / 1000}s
  </div>
  <div class="metric">
    <span class="metric-name">Total Requests:</span> ${data.metrics.http_reqs.values.count}
  </div>
  <div class="metric">
    <span class="metric-name">Request Rate:</span> ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s
  </div>
  <div class="metric">
    <span class="metric-name">Average Response Time:</span> ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
  </div>
  <div class="metric">
    <span class="metric-name">p95 Response Time:</span> ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  </div>
  <div class="metric">
    <span class="metric-name">Error Rate:</span> 
    <span class="${data.metrics.http_req_failed.values.rate > 0.05 ? 'error' : 'success'}">
      ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
    </span>
  </div>
</body>
</html>
  `;
}
