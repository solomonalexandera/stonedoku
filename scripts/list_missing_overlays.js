const fs = require('fs');
const prompts = require('./asset_prompts.json');
const overlays = prompts.overlays || [];
const missing = [];
for (const o of overlays) {
  const f = 'public/assets/' + o.filename;
  if (!fs.existsSync(f)) missing.push(o.filename);
}
console.log(JSON.stringify({missing, all: overlays.map(o=>o.filename)}, null, 2));
