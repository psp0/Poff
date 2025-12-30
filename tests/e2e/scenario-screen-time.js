/**
 * Screen Time E2E Scenario
 */
const API_URL = process.env.API_URL;
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;

if (!API_URL || !TEST_USER_TOKEN) {
  console.error('API_URL and TEST_USER_TOKEN required');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TEST_USER_TOKEN}`,
  'Content-Type': 'application/json'
};

async function run() {
  console.log(`🚀 Starting Screen Time Scenario...`);
  try {
    // 1. 오늘 스크린타임 조회
    console.log('Step 1: Fetching Today Screen Time...');
    const todayRes = await fetch(`${API_URL}/screen-time`, { headers });
    // 404 is acceptable if no data logged today yet, but API usually returns empty object or 0
    if (!todayRes.ok && todayRes.status !== 404) {
      throw new Error(`Failed to fetch today's screen time: ${todayRes.status}`);
    }
    const todayData = await todayRes.json();
    console.log(`   ✅ Today's logged time checked.`);

    // 2. 주간 통계 조회
    console.log('Step 2: Fetching Weekly Stats...');
    const weekRes = await fetch(`${API_URL}/screen-time/weekly-stats`, { headers });
    if (!weekRes.ok) throw new Error(`Failed to fetch weekly stats: ${weekRes.status}`);
    const weekData = await weekRes.json();
    console.log(`   ✅ Weekly stats retrieved.`);

  } catch (e) {
    console.error(`❌ Screen Time Scenario Failed: ${e.message}`);
    process.exit(1);
  }
}

run();
