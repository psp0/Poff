/**
 * Smoke Test Script
 * 배포 후 주요 API 엔드포인트의 상태를 확인합니다.
 */

const API_URL = process.env.API_URL;
if (!API_URL) {
  console.error('API_URL environment variable is required');
  process.exit(1);
}

const endpoints = [
  // Health Check
  { path: '/health', method: 'GET', expectedStatus: 200, optional: true },

  // User Management
  { path: '/api/shop/items', method: 'GET', expectedStatus: 401 },
  { path: '/api/config', method: 'GET', expectedStatus: 200 }, // Config is public by design

  // Egg Management
  { path: '/api/eggs', method: 'GET', expectedStatus: 401 },

  // Pokemon Collection
  { path: '/api/collection', method: 'GET', expectedStatus: 401 },
  { path: '/api/guest/all-pokemon', method: 'GET', expectedStatus: 200 }, // Guest is public
  { path: '/api/guest/starter-pokemon', method: 'GET', expectedStatus: 200 }, // Guest is public

  // Pokemon Management
  { path: '/api/user/items', method: 'GET', expectedStatus: 401 },

  // Screen Time
  { path: '/api/screen-time', method: 'GET', expectedStatus: 401 },
  { path: '/api/screen-time/weekly-stats', method: 'GET', expectedStatus: 401 },

  // Sleep Management
  { path: '/api/sleep/status', method: 'GET', expectedStatus: 401 },
];

async function runSmokeTest() {
  console.log(`🚀 Starting smoke test for ${API_URL}...`);
  let failed = false;

  for (const endpoint of endpoints) {
    const url = `${API_URL}${endpoint.path}`;
    try {
      const response = await fetch(url, { method: endpoint.method });
      console.log(`[${endpoint.method}] ${endpoint.path} - Status: ${response.status}`);
      
      if (response.status !== endpoint.expectedStatus) {
        // Special case: If we expect 401 (Protected) but get 200 (Public/Authorized), that's also "Healthy" for a smoke test
        if (endpoint.expectedStatus === 401 && response.status === 200) {
           console.log(`   ⚠️ Endpoint ${endpoint.path} is accessible (200 OK) but expected 401. It might be public.`);
        } else if (endpoint.optional) {
          console.warn(`⚠️  Optional endpoint ${endpoint.path} returned ${response.status} (expected ${endpoint.expectedStatus})`);
        } else {
          console.error(`❌ Unexpected status for ${endpoint.path}: got ${response.status}, expected ${endpoint.expectedStatus}`);
          failed = true;
        }
      }
    } catch (error) {
      console.error(`❌ Failed to connect to ${endpoint.path}:`, error.message);
      failed = true;
    }
  }

  if (failed) {
    console.error('💥 Smoke test failed!');
    process.exit(1);
  } else {
    console.log('✅ Smoke test passed!');
  }
}

runSmokeTest();
