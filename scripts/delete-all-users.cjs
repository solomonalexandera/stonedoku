/*
 * CommonJS wrapper for delete-all-users.js to allow running in a project
 * that uses ESM (package.json "type": "module").
 *
 * Usage (dry-run):
 *   node scripts/delete-all-users.cjs
 *
 * To execute live (DANGEROUS):
 *   RUN_DELETE=1 GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/delete-all-users.cjs
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const scriptPath = path.resolve(__dirname, 'delete-all-users.js');
const code = fs.readFileSync(scriptPath, 'utf8');

// Run the original file's code inside a CommonJS context so `require` works
const sandbox = { console, process, Buffer, setTimeout, setInterval, clearTimeout, clearInterval, __dirname: path.dirname(scriptPath), __filename: scriptPath, require };
vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: scriptPath });
} catch (err) {
  console.error('Error running delete-all-users in CJS wrapper:', err);
  process.exit(1);
}
