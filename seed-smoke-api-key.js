const crypto = require('crypto');
const Database = require('better-sqlite3');

const salt = process.env.API_KEY_SALT || 'docker-compose-smoke-test';
const dbPath = process.env.SQLITE_PATH || '/app/data/promptmetrics.db';
const key = 'pm_smoke_test_key';
const hash = crypto.createHmac('sha256', salt).update(key).digest('hex');

const db = new Database(dbPath);
db.prepare('INSERT OR IGNORE INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(hash, 'smoke', 'read,write');
db.close();

console.log('Seeded smoke-test API key');
