if (!process.env.API_KEY_SALT) {
  process.env.API_KEY_SALT = 'test-salt-for-ci';
}

// Must require AFTER setting env vars because config module reads them at load time.
const { initSchema } = require('../src/models/promptmetrics-sqlite');
initSchema();
