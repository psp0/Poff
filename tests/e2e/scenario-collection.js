/**
 * Pokemon Collection E2E Scenario
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
  console.log(`🚀 Starting Collection Scenario...`);
  try {
    // 1. 전체 포켓몬 도감 데이터 (Static Data)
    console.log('Step 1: Fetching All Pokemon Data...');
    const allRes = await fetch(`${API_URL}/guest/all-pokemon`, { headers });
    if (!allRes.ok) throw new Error(`Failed to fetch all pokemon: ${allRes.status}`);
    const allData = await allRes.json();
    console.log(`   ✅ Loaded reference data for ${allData.data?.length} pokemon.`);

    // 2. 사용자 컬렉션 조회
    console.log('Step 2: Fetching User Collection...');
    const colRes = await fetch(`${API_URL}/collection?page=1&limit=10`, { headers });
    if (!colRes.ok) throw new Error(`Failed to fetch collection: ${colRes.status}`);
    const colData = await colRes.json();
    console.log(`   ✅ User has ${colData.data?.pagination?.total || 0} pokemon in collection.`);

    // 3. 스타팅 포켓몬 목록 조회 (가입 시 사용되는 데이터)
    console.log('Step 3: Fetching Starters...');
    const starRes = await fetch(`${API_URL}/guest/starter-pokemon`, { headers });
    if (!starRes.ok) throw new Error(`Failed to fetch starters: ${starRes.status}`);
    const starters = await starRes.json();
    console.log(`   ✅ Found ${starters.data?.length} starter pokemon candidates.`);

  } catch (e) {
    console.error(`❌ Collection Scenario Failed: ${e.message}`);
    process.exit(1);
  }
}

run();
