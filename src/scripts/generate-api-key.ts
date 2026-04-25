import crypto from 'crypto';
import { getDb } from '@models/promptmetrics-sqlite';
import { hashApiKey } from '@middlewares/promptmetrics-auth.middleware';

function parseArgs(argv: string[]): { name: string; scopes: string; expiresInDays?: number } {
  let name = 'default';
  let scopes = 'read,write';
  let expiresInDays: number | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--expires-in-days') {
      const next = argv[i + 1];
      if (next && /^\d+$/.test(next)) {
        expiresInDays = parseInt(next, 10);
        i++;
      }
    } else if (arg.startsWith('--')) {
      continue;
    } else if (name === 'default') {
      name = arg;
    } else if (scopes === 'read,write') {
      scopes = arg;
    }
  }

  return { name, scopes, expiresInDays };
}

function main(): void {
  const { name, scopes, expiresInDays } = parseArgs(process.argv);

  const apiKey = `pm_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(apiKey);

  const db = getDb();
  let expiresAt: number | undefined;
  if (expiresInDays !== undefined) {
    expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  }

  db.prepare(
    'INSERT INTO api_keys (key_hash, name, scopes, expires_at) VALUES (?, ?, ?, ?)',
  ).run(keyHash, name, scopes, expiresAt ?? null);

  console.log('\n=== Generated API Key ===');
  console.log('Name:', name);
  console.log('Scopes:', scopes);
  if (expiresAt) {
    console.log('Expires:', new Date(expiresAt * 1000).toISOString());
  }
  console.log('Key:', apiKey);
  console.log('=========================\n');
  console.log('Store this key safely. It will not be shown again.');

  process.exit(0);
}

main();
