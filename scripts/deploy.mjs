// One-command deploy to Cloudflare (run after `npx wrangler login`).
//   node scripts/deploy.mjs            first run: creates D1 + R2, secrets, loads demo data, deploys both workers
//   node scripts/deploy.mjs            later runs: rebuilds and redeploys (data is never overwritten)
// Settings are remembered in deploy.config.json. To use your own domain, set "storeDomain" there
// (the domain must already be on your Cloudflare account) and run the script again. The admin is at <store>/admin.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const CFG = 'deploy.config.json';
const cfg = existsSync(CFG) ? JSON.parse(readFileSync(CFG, 'utf8')) : {};
const save = () => writeFileSync(CFG, JSON.stringify(cfg, null, 2) + '\n');
const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'], input: opts.input });
const step = (m) => console.log(`\n▶ ${m}`);

step('Checking Cloudflare login');
try { console.log(sh('npx wrangler whoami').split('\n').filter((l) => /logged in|account/i.test(l)).slice(0, 3).join('\n')); }
catch { console.error('Not logged in. Run: npx wrangler login'); process.exit(1); }

// ---- D1 database ----
step('Database (D1)');
const findDb = () => JSON.parse(sh('npx wrangler d1 list --json')).find((d) => d.name === 'sutoloka-db');
let db = findDb();
if (!db) { sh('npx wrangler d1 create sutoloka-db', { inherit: true }); db = findDb(); }
cfg.databaseId = db.uuid;
for (const f of ['store/wrangler.jsonc']) {
  writeFileSync(f, readFileSync(f, 'utf8').replace(/"database_id": "[^"]*"/, `"database_id": "${db.uuid}"`));
}
console.log(`sutoloka-db ${db.uuid}`);

// ---- R2 bucket ----
step('Image storage (R2)');
try { sh('npx wrangler r2 bucket create sutoloka-media'); console.log('created sutoloka-media'); }
catch (e) {
  const msg = String(e.stderr || e.message);
  if (/already exists|already own/i.test(msg)) console.log('sutoloka-media already exists');
  else { console.error(msg); console.error('\nIf R2 is not enabled yet, open Cloudflare dashboard → R2 → "Purchase R2" (free tier) once, then rerun.'); process.exit(1); }
}

// ---- Schema + demo data (first time only) ----
step('Database tables and demo data');
sh('node scripts/build-demo-seed.mjs', { inherit: true });
sh('node scripts/db.mjs init --remote', { inherit: true });

// ---- Build ----
step('Building');
sh('npm run build', { inherit: true });

const deploy = (config, vars) => {
  const v = Object.entries(vars).map(([k, val]) => `--var ${k}:${val}`).join(' ');
  const out = sh(`npx wrangler deploy -c ${config} ${v}`);
  console.log(out.split('\n').filter((l) => /https?:\/\/|Uploaded|Deployed|Current Version/i.test(l)).join('\n'));
  return (out.match(/https:\/\/[^\s]+\.workers\.dev/) || [])[0];
};

// Custom domains (optional)
const withDomain = (file, domain) => {
  let txt = readFileSync(file, 'utf8').replace(/,\s*"routes": \[[^\]]*\]/, '');
  if (domain) txt = txt.replace(/\n}\s*$/, `,\n  "routes": [{ "pattern": "${domain}", "custom_domain": true }]\n}\n`);
  writeFileSync(file, txt);
};
withDomain('store/wrangler.jsonc', cfg.storeDomain);

step('Deploying store');
const storeUrl = cfg.storeDomain ? `https://${cfg.storeDomain}` : cfg.storeUrl;
const s = deploy('store/wrangler.jsonc', { SITE_URL: storeUrl || 'https://example.invalid' });
cfg.storeUrl = cfg.storeDomain ? `https://${cfg.storeDomain}` : s || cfg.storeUrl;
if (!storeUrl && cfg.storeUrl) deploy('store/wrangler.jsonc', { SITE_URL: cfg.storeUrl }); // first run: now we know the URL

cfg.adminUrl = `${cfg.storeUrl}/admin`;
save();

// ---- Secrets (generated once; kept in Cloudflare only) ----
step('Secret keys');
const hasSecret = (config, name) => { try { return JSON.parse(sh(`npx wrangler secret list -c ${config} --format json`)).some((x) => x.name === name); } catch { return false; } };
for (const [config, name] of [['store/wrangler.jsonc', 'CUSTOMER_SECRET'], ['store/wrangler.jsonc', 'JWT_SECRET']]) {
  if (hasSecret(config, name)) { console.log(`${name} already set`); continue; }
  sh(`npx wrangler secret put ${name} -c ${config}`, { input: randomBytes(32).toString('hex') });
  console.log(`${name} set`);
}

console.log(`\n✅ Done\n   Store: ${cfg.storeUrl}\n   Admin: ${cfg.adminUrl}\n   Open the admin first to create the owner account (username + password).\n`);
