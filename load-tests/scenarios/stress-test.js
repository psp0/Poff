/**
 * Stress Test
 * 
 * Purpose: Find the breaking point of the system
 * VUs: Gradually increase until system degrades
 * Duration: 10-15 minutes
 * Use case: Identify system limits and breaking points
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getEnvConfig, randomPokemonId } from '../utils/config.js';

const envConfig = getEnvConfig();
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '3m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // Allow higher latency under stress
    http_req_failed: ['rate<0.1'],      // Allow up to 10% errors
    errors: ['rate<0.15'],               // Custom error rate < 15%
  },
};

export default function () {
  const baseUrl = envConfig.baseUrl;
  
  // High-frequency API calls to stress the system
  const batch = [
    ['GET', `${baseUrl}/api/pokemon`, null],
    ['GET', `${baseUrl}/api/pokemon/${randomPokemonId()}`, null],
    ['GET', `${baseUrl}/api/pokemon/${randomPokemonId()}`, null],
    ['GET', `${baseUrl}/api/user/collection`, null],
  ];
  
  const responses = http.batch(batch);
  
  for (let res of responses) {
    const success = check(res, {
      'status is 2xx or 4xx': (r) => r.status >= 200 && r.status < 500,
    });
    errorRate.add(!success);
  }
  
  sleep(0.5); // Minimal sleep to maintain pressure
}

export function handleSummary(data) {
  const avgResponseTime = data.metrics.http_req_duration.values.avg;
  const p95ResponseTime = data.metrics.http_req_duration.values['p(95)'];
  const errorRateValue = data.metrics.http_req_failed.values.rate;
  
  const result = {
    timestamp: new Date().toISOString(),
    testType: 'stress',
    duration: data.state.testRunDurationMs / 1000,
    totalRequests: data.metrics.http_reqs.values.count,
    requestRate: data.metrics.http_reqs.values.rate,
    avgResponseTime: avgResponseTime,
    p95ResponseTime: p95ResponseTime,
    p99ResponseTime: data.metrics.http_req_duration.values['p(99)'],
    errorRate: errorRateValue,
    maxVUs: 200,
    systemHealth: determineSystemHealth(avgResponseTime, p95ResponseTime, errorRateValue)
  };
  
  console.log('\n=== Stress Test Summary ===');
  console.log(`System Health: ${result.systemHealth}`);
  console.log(`Max VUs Tested: ${result.maxVUs}`);
  console.log(`Total Requests: ${result.totalRequests}`);
  console.log(`Request Rate: ${result.requestRate.toFixed(2)} req/s`);
  console.log(`Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`p95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
  console.log(`Error Rate: ${(result.errorRate * 100).toFixed(2)}%`);
  
  return {
    'results/stress-test-summary.json': JSON.stringify(result, null, 2),
  };
}

function determineSystemHealth(avg, p95, errorRate) {
  if (errorRate > 0.15 || p95 > 3000) {
    return 'CRITICAL - System at breaking point';
  } else if (errorRate > 0.08 || p95 > 2000) {
    return 'WARNING - System under heavy stress';
  } else if (errorRate > 0.05 || p95 > 1500) {
    return 'DEGRADED - Performance degradation detected';
  } else {
    return 'HEALTHY - System handling stress well';
  }
}
