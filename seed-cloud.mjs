// seed-cloud.mjs

const CLOUD_URL  = 'https://third-buzzard-948.convex.cloud';
const DEPLOY_KEY = 'prod:third-buzzard-948|eyJ2MiI6ImU5ZDNiNzZjZDM1MzQ4NmRhNmJkMDA1NTlkYWNhYmI4In0=';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Convex ${DEPLOY_KEY}`,
};

async function callMutation(name, args = {}) {
  const res = await fetch(`${CLOUD_URL}/api/mutation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(`${name} failed: ${data.errorMessage}`);
  return data.value;
}

async function callAction(name, args = {}) {
  const res = await fetch(`${CLOUD_URL}/api/action`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(`${name} failed: ${data.errorMessage}`);
  return data.value;
}

async function callQuery(name, args = {}) {
  const res = await fetch(`${CLOUD_URL}/api/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: name, args }),
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(`${name} failed: ${data.errorMessage}`);
  return data.value;
}

async function main() {
  console.log('☁️  Seeding cloud Convex deployment...\n');

  // 1. Seed roles, categories, admin user, leave types
  console.log('1️⃣  Running seedAll (roles, categories, users, leave types)...');
  try {
    const r = await callMutation('seed:seedAll', {});
    console.log('   ✅', r);
  } catch (e) {
    console.log('   ⚠️  seedAll:', e.message, '(may already exist — continuing)');
  }

  // 2. Seed districts
  console.log('2️⃣  Seeding districts...');
  try {
    const r = await callMutation('seedDistricts:seedDistricts', {});
    console.log('   ✅', r);
  } catch (e) {
    console.log('   ⚠️  seedDistricts:', e.message, '(may already exist — continuing)');
  }

  // 3. Log in as admin to get a session token
  console.log('3️⃣  Logging in as admin to get session token...');
  const loginResult = await callMutation('auth:login', {
    email:    'admin@pf.health.gov.tt',
    password: 'Admin@1234',
  });
  console.log('   loginResult:', JSON.stringify(loginResult));

  const token = loginResult?.token ?? loginResult?.sessionToken ?? loginResult;
  if (!token || typeof token !== 'string') {
    throw new Error('Could not extract token from login result: ' + JSON.stringify(loginResult));
  }
  console.log('   ✅ Token obtained:', token.slice(0, 20) + '...');

  // 4. Run the seed action on cloud  
  console.log('\n4️⃣  Running seedTestIssues on cloud (this takes 1-2 mins, fetching images)...');
  const result = await callAction('seedIssues:seedTestIssues', { token });

  console.log('\n🎉 Done!');
  console.log(`   Deleted: ${result.deleted}`);
  console.log(`   Created: ${result.created}`);
  console.log('\nLog:');
  result.log.forEach(line => console.log(' ', line));
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
