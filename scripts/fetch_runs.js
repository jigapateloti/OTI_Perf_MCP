const sm = require('../sdk/sessionManager');

(async () => {
  try {
    console.log('Authenticating...');
    const client = await sm.getAuthenticatedClient();
    console.log('Fetching runs...');
    const runs = await client.getRuns();
    if (!Array.isArray(runs)) {
      console.error('Unexpected runs response:', runs);
      process.exit(1);
    }
    const last = runs.slice(-10).reverse();
    console.log(JSON.stringify(last, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
