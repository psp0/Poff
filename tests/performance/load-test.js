import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

export default function () {
  const API_URL = __ENV.API_URL;
  // Note: For real load testing, you'd need a valid token mechanism or a mock auth endpoint.
  // For now, we'll test a public endpoint or health check if available.
  
  const res = http.get(`${API_URL}/health`); // Assuming a health endpoint exists or similar
  
  // If no public endpoint, we might simulate an unauthorized call to check gateway performance
  // const res = http.get(`${API_URL}/eggs`); 

  check(res, {
    'status is 200 (or 401)': (r) => r.status === 200 || r.status === 401,
    'protocol is HTTP/2': (r) => r.proto === 'HTTP/2.0',
  });

  sleep(1);
}
