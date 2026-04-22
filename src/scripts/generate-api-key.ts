import crypto from 'crypto';
import { getDb } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

function main(): void {
  const name = process.argv[2] || 'default';
  const scopes = process.argv[3] || 'read,write';

  const apiKey = `pm_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(apiKey);

  const db = getDb();
  db.prepare('INSERT INTO api_keys (key_hash, name, scopes) VALUES (?, ?, ?)').run(
    keyHash,
    name,
    scopes,
  );

  console.log('\n=== Generated API Key ===');
  console.log('Name:', name);
  console.log('Scopes:', scopes);
  console.log('Key:', apiKey);
  console.log('=========================\n');
  console.log('Store this key safely. It will not be shown again.');

  process.exit(0);
}

main();
