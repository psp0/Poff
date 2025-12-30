/**
 * User & Shop E2E Scenario
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
  console.log(`🚀 Starting User & Shop Scenario...`);
  try {
    // 1. 내 아이템 조회 (User Management)
    console.log('Step 1: Fetching User Items...');
    const itemRes = await fetch(`${API_URL}/user/items`, { headers });
    if (!itemRes.ok) throw new Error(`Failed to fetch user items: ${itemRes.status}`);
    const items = await itemRes.json();
    console.log(`   ✅ User has ${items.data?.length || 0} types of items.`);

    // 2. 상점 목록 조회 (User Management - Public/Protected)
    console.log('Step 2: Fetching Shop Items...');
    const shopRes = await fetch(`${API_URL}/shop/items`, { headers });
    if (!shopRes.ok) throw new Error(`Failed to fetch shop items: ${shopRes.status}`);
    const shop = await shopRes.json();
    console.log(`   ✅ Shop has ${shop.data?.length || 0} items for sale.`);

  } catch (e) {
    console.error(`❌ User Scenario Failed: ${e.message}`);
    process.exit(1);
  }
}

run();
