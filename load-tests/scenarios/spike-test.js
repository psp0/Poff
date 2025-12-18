/**
 * Spike Test
 * 
 * Purpose: Test system behavior under sudden traffic spikes
 * VUs: Sudden increase from low to very high
 * Duration: 5-10 minutes
 * Use case: Validate auto-scaling and spike handling (e.g., viral content, marketing campaigns)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getEnvConfig, randomPokemonId } from '../utils/config.js';

const envConfig = getEnvConfig();
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Start with 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '10s', target: 200 },  // SPIKE to 200 users in 10 seconds!
    { duration: '3m', target: 200 },   // Maintain spike for 3 minutes
    { duration: '10s', target: 10 },   // Drop back down quickly
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // Allow higher latency during spike
    http_req_failed: ['rate<0.15'],     // Allow up to 15% errors during spike
  },
};

export default function () {
  const baseUrl = envConfig.baseUrl;
  
  // Simulate typical user behavior during spike
  const res = http.get(`${baseUrl}/api/pokemon`);
  const success = check(res, {
    'pokemon list loaded': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 5000,
  });
  errorRate.add(!success);
  
  sleep(1);
  
  // Get random Pokemon during spike
  const pokemonId = randomPokemonId();
  const detailRes = http.get(`${baseUrl}/api/pokemon/${pokemonId}`);
  check(detailRes, {
    'pokemon detail loaded': (r) => [200, 404].includes(r.status),
  });
  
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function handleSummary(data) {
  const result = {
    timestamp: new Date().toISOString(),
    testType: 'spike',
    spikeTarget: 200,
    spikeDuration: '3m',
    totalRequests: data.metrics.http_reqs.values.count,
    avgResponseTime: data.metrics.http_req_duration.values.avg,
    p95ResponseTime: data.metrics.http_req_duration.values['p(95)'],
    p99ResponseTime: data.metrics.http_req_duration.values['p(99)'],
    errorRate: data.metrics.http_req_failed.values.rate,
    recoveryTime: 'See detailed logs',
    recommendation: generateRecommendation(data)
  };
  
  console.log('\n=== Spike Test Summary ===');
  console.log(`Spike Target: ${result.spikeTarget} users`);
  console.log(`Total Requests: ${result.totalRequests}`);
  console.log(`Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`p95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
  console.log(`Error Rate: ${(result.errorRate * 100).toFixed(2)}%`);
  console.log(`\nRecommendation: ${result.recommendation}`);
  
  return {
    'results/spike-test-summary.json': JSON.stringify(result, null, 2),
  };
}

function generateRecommendation(data) {
  const errorRate = data.metrics.http_req_failed.values.rate;
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  
  if (errorRate > 0.2) {
    return 'CRITICAL: System failed to handle spike. Consider implementing rate limiting, increasing auto-scaling aggressiveness, or adding a CDN.';
  } else if (errorRate > 0.1 || p95 > 3000) {
    return 'WARNING: System struggled with spike. Review Lambda concurrency limits, RDS connection pooling, and CloudFront caching.';
  } else if (p95 > 2000) {
    return 'CAUTION: Performance degraded during spike. Consider pre-warming Lambda functions or increasing provisioned concurrency.';
  } else {
    return 'SUCCESS: System handled spike well. Current configuration is adequate for traffic spikes.';
  }
}
