/**
 * Enhanced Smoke Test Script
 * 배포 후 주요 API 엔드포인트의 리치 여부와 응답의 '데이터 구조'까지 정밀하게 검증합니다.
 */

const API_URL = process.env.API_URL;
if (!API_URL) {
  console.error('API_URL environment variable is required');
  process.exit(1);
}

const endpoints = [
  // Health Check - Lambda 에서는 런타임마다 구조가 다르므로 Optional 처리
  { path: '/health', method: 'GET', expectedStatus: 200, optional: true },

  // Public Endpoints (정상적인 200 OK와 DB 조회 결과가 반환되는지 확인)
  { 
    path: '/api/shop/items', 
    method: 'GET', 
    expectedStatus: 200, 
    validate: (res) => res.success === true && Array.isArray(res.data) && res.data.length > 0 
  },
  { 
    path: '/api/config', 
    method: 'GET', 
    expectedStatus: 200, 
    validate: (res) => res.success === true && res.data && res.data.firebase 
  },
  { 
    path: '/api/guest/all-pokemon', 
    method: 'GET', 
    expectedStatus: 200, 
    validate: (res) => Array.isArray(res) ? res.length > 0 : (res.success && Array.isArray(res.data))
  },
  { 
    path: '/api/guest/starter-pokemon', 
    method: 'GET', 
    expectedStatus: 200, 
    validate: (res) => Array.isArray(res) ? res.length > 0 : (res.success && Array.isArray(res.data))
  },

  // Protected Endpoints (미인증 호출 시 미들웨어를 정상적으로 통과하여 비즈니스 로직 레벨의 거부(400/401)가 발생하는지 확인)
  { 
    path: '/api/eggs', 
    method: 'GET', 
    expectedStatus: 400, 
    validate: (res) => res.success === false && typeof res.error === 'string' 
  },
  { 
    path: '/api/collection', 
    method: 'GET', 
    expectedStatus: 400, 
    validate: (res) => res.success === false && typeof res.error === 'string' 
  },
  { 
    path: '/api/user/items', 
    method: 'GET', 
    expectedStatus: 400,
    validate: (res) => res.success === false && typeof res.error === 'string' 
  },
  { 
    path: '/api/screen-time', 
    method: 'GET', 
    expectedStatus: 400,
    validate: (res) => res.success === false && typeof res.error === 'string' 
  },
];

async function runSmokeTest() {
  console.log(`🚀 Starting ENHANCED smoke test for ${API_URL}...`);
  let failed = false;

  for (const endpoint of endpoints) {
    const url = `${API_URL}${endpoint.path}`;
    try {
      const response = await fetch(url, { 
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      const status = response.status;
      
      console.log(`\n[${endpoint.method}] ${endpoint.path} - Status: ${status}`);

      if (status !== endpoint.expectedStatus) {
        if (endpoint.optional) {
          console.warn(`   ⚠️ Optional endpoint returned ${status} (expected ${endpoint.expectedStatus})`);
        } else {
          console.error(`   ❌ Unexpected status: got ${status}, expected ${endpoint.expectedStatus}`);
          failed = true;
        }
        continue;
      }

      // JSON 데이터 파싱 및 검증 단계
      if (endpoint.validate && (!endpoint.optional || status === 200)) {
        try {
          const bodyText = await response.text();
          let bodyJSON = null;
          
          if (bodyText) {
            bodyJSON = JSON.parse(bodyText);
          }

          if (endpoint.validate(bodyJSON)) {
            console.log(`   ✅ Content validation passed`);
          } else {
            console.error(`   ❌ Content validation failed`);
            console.error(`      Body: ${bodyText.substring(0, 150)}...`);
            failed = true;
          }
        } catch (e) {
          console.error(`   ❌ Error during validation: ${e.message}`);
          failed = true;
        }
      } else {
         console.log(`   ✅ Status match passed (No specific validation rules)`);
      }

    } catch (error) {
      console.error(`❌ Failed to connect to ${endpoint.path}:`, error.message);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n💥 Smoke test failed!');
    process.exit(1);
  } else {
    console.log('\n🌟 All smoke tests passed successfully! DB connections and routing are verified.');
  }
}

runSmokeTest();
