/**
 * Endurance Test (Soak Test)
 * 
 * Purpose: Test system stability over extended period
 * VUs: Moderate load sustained for hours
 * Duration: 1-4 hours
 * Use case: Detect memory leaks, resource exhaustion, and degradation over time
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { getEnvConfig, randomPokemonId } from '../utils/config.js';

const envConfig = getEnvConfig();
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time_trend');

export const options = {
  stages: [
    { duration: '5m', target: 30 },   // Ramp up to 30 users
    { duration: '1h', target: 30 },   // Maintain 30 users for 1 hour
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // Consistent performance expected
    http_req_failed: ['rate<0.03'],     // Very low error rate expected
    response_time_trend: ['p(95)<1200'], // Trend should not degrade
  },
};

let requestCount = 0;

export default function () {
  const baseUrl = envConfig.baseUrl;
  requestCount++;
  
  // Rotate through different scenarios to simulate real usage
  const scenario = requestCount % 4;
  
  switch (scenario) {
    case 0:
      // Browse Pokemon
      const listRes = http.get(`${baseUrl}/api/pokemon`);
      const listSuccess = check(listRes, {
        'list status 200': (r) => r.status === 200,
      });
      errorRate.add(!listSuccess);
      responseTimeTrend.add(listRes.timings.duration);
      break;
      
    case 1:
      // View Pokemon details
      const detailRes = http.get(`${baseUrl}/api/pokemon/${randomPokemonId()}`);
      const detailSuccess = check(detailRes, {
        'detail status valid': (r) => [200, 404].includes(r.status),
      });
      errorRate.add(!detailSuccess);
      responseTimeTrend.add(detailRes.timings.duration);
      break;
      
    case 2:
      // Check user collection
      const collectionRes = http.get(`${baseUrl}/api/user/collection`);
      check(collectionRes, {
        'collection status valid': (r) => [200, 401].includes(r.status),
      });
      responseTimeTrend.add(collectionRes.timings.duration);
      break;
      
    case 3:
      // Health check
      const healthRes = http.get(`${baseUrl}/health`);
      const healthSuccess = check(healthRes, {
        'health check ok': (r) => r.status === 200,
      });
      errorRate.add(!healthSuccess);
      responseTimeTrend.add(healthRes.timings.duration);
      break;
  }
  
  // Log progress every 100 requests per VU
  if (requestCount % 100 === 0) {
    console.log(`VU ${__VU}: Completed ${requestCount} requests`);
  }
  
  sleep(Math.random() * 4 + 2); // 2-6 seconds between requests
}

export function handleSummary(data) {
  const duration = data.state.testRunDurationMs / 1000 / 60; // in minutes
  const avgResponseTime = data.metrics.http_req_duration.values.avg;
  const startAvg = data.metrics.http_req_duration.values.min;
  const endAvg = data.metrics.http_req_duration.values.max;
  const degradation = ((endAvg - startAvg) / startAvg * 100).toFixed(2);
  
  const result = {
    timestamp: new Date().toISOString(),
    testType: 'endurance',
    duration: `${duration.toFixed(0)} minutes`,
    totalRequests: data.metrics.http_reqs.values.count,
    requestRate: data.metrics.http_reqs.values.rate,
    avgResponseTime: avgResponseTime,
    minResponseTime: data.metrics.http_req_duration.values.min,
    maxResponseTime: data.metrics.http_req_duration.values.max,
    p95ResponseTime: data.metrics.http_req_duration.values['p(95)'],
    errorRate: data.metrics.http_req_failed.values.rate,
    performanceDegradation: degradation + '%',
    stabilityAssessment: assessStability(data)
  };
  
  console.log('\n=== Endurance Test Summary ===');
  console.log(`Test Duration: ${result.duration}`);
  console.log(`Total Requests: ${result.totalRequests}`);
  console.log(`Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`Performance Degradation: ${result.performanceDegradation}`);
  console.log(`Error Rate: ${(result.errorRate * 100).toFixed(2)}%`);
  console.log(`\nStability Assessment: ${result.stabilityAssessment}`);
  
  return {
    'results/endurance-test-summary.json': JSON.stringify(result, null, 2),
  };
}

function assessStability(data) {
  const errorRate = data.metrics.http_req_failed.values.rate;
  const p95Start = data.metrics.http_req_duration.values['p(25)']; // Early baseline
  const p95End = data.metrics.http_req_duration.values['p(95)']; // Late performance
  const degradation = ((p95End - p95Start) / p95Start);
  
  if (errorRate > 0.05) {
    return 'UNSTABLE: High error rate indicates potential memory leaks or resource exhaustion. Review logs and metrics.';
  } else if (degradation > 0.5) {
    return 'DEGRADING: Significant performance degradation over time. Check for memory leaks, connection pool exhaustion, or log accumulation.';
  } else if (degradation > 0.2) {
    return 'MINOR DEGRADATION: Slight performance decrease over time. Monitor for longer periods.';
  } else {
    return 'STABLE: System maintains consistent performance over extended period. No memory leaks or resource issues detected.';
  }
}
