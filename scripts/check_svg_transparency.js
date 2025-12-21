const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function check(svgPath) {
  if (!fs.existsSync(svgPath)) {
    console.error('MISSING', svgPath);
    process.exit(2);
  }
  const txt = fs.readFileSync(svgPath, 'utf8');
  if (txt.includes('<image') && txt.includes('data:image/png;base64,')) {
    const m = txt.match(/data:image\/png;base64,([A-Za-z0-9+/=\n\r]+)/);
    if (!m) {
      console.log('embedded-png: not-found');
      process.exit(0);
    }
    const b64 = m[1].replace(/\s+/g, '');
    const buf = Buffer.from(b64, 'base64');
    try {
      const meta = await sharp(buf).metadata();
      console.log('embedded-png: width=' + meta.width + ' height=' + meta.height + ' hasAlpha=' + (meta.hasAlpha?true:false));
      process.exit(meta.hasAlpha?0:1);
    } catch (e) {
      console.log('embedded-png: sharp-error', e.message);
      process.exit(3);
    }
  }

  // If vector SVG, look for transparent indicators
  const lower = txt.toLowerCase();
  const transparentIndicators = ['background="transparent"', "background:transparent", 'fill="none"', 'fill:none', 'opacity="0"', 'rgba(0,0,0,0)'];
  for (const ind of transparentIndicators) {
    if (lower.includes(ind)) {
      console.log('svg-indicator: ' + ind + ' -> likely-transparent');
      process.exit(0);
    }
  }
  // If nothing found, report unknown
  console.log('unknown-transparent: no clear transparency markers found');
  process.exit(1);
}

const target = process.argv[2] || path.join(__dirname, '..', 'public', 'assets', 'overlay-vault-ribs.svg');
check(target).catch(e=>{console.error('error', e); process.exit(4);});
