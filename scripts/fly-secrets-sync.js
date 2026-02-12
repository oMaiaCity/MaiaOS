#!/usr/bin/env bun
/**
 * Sync local .env to Fly.io secrets.
 * Overwrites remote secrets with values from .env.
 *
 * Usage: bun run deploy:secrets
 *   or:  bun scripts/fly-secrets-sync.js
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function parseEnv(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function run(cmd, args) {
  const proc = Bun.spawnSync([cmd, ...args], { cwd: rootDir, stdio: ['inherit', 'inherit', 'inherit'] });
  if (proc.exitCode !== 0) throw new Error(`${cmd} exited ${proc.exitCode}`);
}

async function main() {
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) {
    console.error('❌ .env not found');
    process.exit(1);
  }

  const content = readFileSync(envPath, 'utf-8');
  const env = parseEnv(content);

  console.log('🔄 Syncing .env to Fly.io secrets...\n');

  // Moai secrets - PEER_ID and PEER_SECRET required (moai never generates keys, only takes from env)
  const moaiRequired = ['PEER_ID', 'PEER_SECRET'];
  const moaiMissing = moaiRequired.filter((k) => !env[k]);
  if (moaiMissing.length > 0) {
    console.error(`❌ Moai requires PEER_ID and PEER_SECRET in .env. Missing: ${moaiMissing.join(', ')}`);
    console.error('   Run: bun agent:generate');
    process.exit(1);
  }
  const moaiVars = ['PEER_ID', 'PEER_SECRET', 'RED_PILL_API_KEY'];
  const moaiArgs = moaiVars.filter((k) => env[k]).flatMap((k) => [`${k}=${env[k]}`]);
  console.log('📦 moai-next-maia-city: PEER_ID, PEER_SECRET', env.RED_PILL_API_KEY ? '+ RED_PILL_API_KEY' : '');
  run('flyctl', ['secrets', 'set', ...moaiArgs, '--app', 'moai-next-maia-city']);
  console.log('✅ Moai secrets set\n');

  // Maia: no secrets needed - sync domain from fly.toml [build.args] (VITE_PEER_MOAI) at build time
  console.log('📦 next-maia-city: (no secrets - VITE_PEER_MOAI from fly.toml [build.args])\n');

  console.log('✅ Done. Verify: flyctl secrets list --app moai-next-maia-city');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
