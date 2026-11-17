// Database helper.
//   node scripts/db.mjs reset --local    drop + schema + seed on the LOCAL dev database
//   node scripts/db.mjs init --remote    schema + seed on the Cloudflare database (refuses if it already has products)
import { execSync } from 'node:child_process';
const [cmd, where] = process.argv.slice(2);
const target = where === '--remote' ? '--remote' : '--local --persist-to .wrangler/state';
const run = (args) => execSync(`npx wrangler d1 execute sutoloka-db ${target} -c store/wrangler.jsonc ${args}`, { stdio: 'inherit' });
if (cmd === 'reset' && where === '--local') {
  run('--file db/drop.sql'); run('--file db/schema.sql'); run('--file db/seed.sql');
} else if (cmd === 'init' && where === '--remote') {
  run('--file db/schema.sql');
  const out = execSync(`npx wrangler d1 execute sutoloka-db --remote -c store/wrangler.jsonc --json --command "SELECT COUNT(*) AS n FROM products"`).toString();
  if (JSON.parse(out)[0].results[0].n > 0) { console.log('Remote database already has products — seed skipped.'); process.exit(0); }
  run('--file db/seed.sql');
} else {
  console.log('Usage: node scripts/db.mjs reset --local | init --remote'); process.exit(1);
}
