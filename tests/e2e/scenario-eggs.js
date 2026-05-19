/**
 * Simple E2E Test Script
 * 실제 배포된 DEV 환경에 대해 주요 사용자 시나리오를 검증합니다.
 */

const API_URL = process.env.API_URL;
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN; // Firebase ID Token

if (!API_URL || !TEST_USER_TOKEN) {
  console.error('API_URL and TEST_USER_TOKEN environment variables are required');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TEST_USER_TOKEN}`,
  'Content-Type': 'application/json'
};

async function runE2E() {
  console.log(`🚀 Starting E2E test against ${API_URL}...`);
  let failed = false;

  try {
    // 1. 알 목록 조회
    console.log('Step 1: Fetching User Eggs...');
    const eggsRes = await fetch(`${API_URL}/eggs`, { headers });
    if (!eggsRes.ok) throw new Error(`Failed to fetch eggs: ${eggsRes.status}`);
    const eggsData = await eggsRes.json();
    console.log(`   ✅ Fetched ${eggsData.data.eggs.length} eggs. Round Charms: ${eggsData.data.round_charms}`);

    // 2. 포켓몬 검색 (알 획득을 위해)
    console.log('Step 2: Searching for Pokemon...');
    const searchRes = await fetch(`${API_URL}/eggs/search?query=피카츄`, { headers });
    if (!searchRes.ok) throw new Error(`Failed to search pokemon: ${searchRes.status}`);
    const searchData = await searchRes.json();
    console.log(`   ✅ Found ${searchData.data.length} pokemon matches.`);

    // 3. 알 획득 시도 (피카츄)
    // 주의: 테스트 계정의 상태에 따라 실패할 수도 있음 (슬롯 꽉 참, 부적 부족 등).
    // 여기서는 API 호출 자체가 정상적으로 처리되는지(500 에러가 아닌지)만 확인.
    if (searchData.data.length > 0) {
      const target = searchData.data[0];
      console.log(`Step 3: Attempting to acquire egg for ${target.name} (${target.stable_id})...`);

      const acquireRes = await fetch(`${API_URL}/eggs/acquire`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pokemonStableId: target.stable_id })
      });

      const acquireData = await acquireRes.json();

      if (acquireRes.ok) {
        console.log(`   ✅ Egg acquired successfully: ${acquireData.data.message}`);
      } else {
        // 400 에러는 비즈니스 로직 상의 거절이므로(부적 부족 등) 테스트 실패로 간주하지 않음
        if (acquireRes.status === 400 || acquireRes.status === 409) {
          console.log(`   ⚠️ Egg acquisition denied (Expected behavior for test): ${acquireData.error}`);
        } else {
          throw new Error(`Unexpected error during egg acquisition: ${acquireRes.status} - ${acquireData.error}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ E2E Test Failed:', error.message);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log('✨ E2E Test Completed Successfully');
}

runE2E();
