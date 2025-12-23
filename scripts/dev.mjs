import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';

function inferPort() {
  if (process.env.PORT) return Number.parseInt(process.env.PORT, 10);

  return 8080;
}

const PORT = inferPort();
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(process.cwd());

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const cleaned = decoded.replaceAll('\\', '/');
  const relative = cleaned.startsWith('/') ? cleaned.slice(1) : cleaned;
  const fullPath = path.resolve(ROOT, relative || 'index.html');
  if (!fullPath.startsWith(ROOT)) return null;
  return fullPath;
}

const reloadClient = `
<script>
(() => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(proto + '://' + location.host + '/__ws');
  ws.addEventListener('message', (ev) => {
    if (ev.data === 'reload') location.reload();
  });
})();
</script>
`;

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    if (req.url.startsWith('/__ws')) {
      res.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Upgrade Required');
      return;
    }

    if (req.url.startsWith('/__health')) {
      const stylesPath = path.join(ROOT, 'styles.css');
      const indexPath = path.join(ROOT, 'index.html');
      const [stylesStat, indexStat] = await Promise.allSettled([stat(stylesPath), stat(indexPath)]);
      writeNoStore(res, 200, 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        ok: true,
        root: ROOT,
        now: new Date().toISOString(),
        files: {
          'styles.css': stylesStat.status === 'fulfilled' ? { mtimeMs: stylesStat.value.mtimeMs, size: stylesStat.value.size } : null,
          'index.html': indexStat.status === 'fulfilled' ? { mtimeMs: indexStat.value.mtimeMs, size: indexStat.value.size } : null
        }
      }));
      return;
    }

    const filePath = safeResolve(req.url);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    let fileStat;
    try {
      fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        fileStat = await stat(indexPath);
        const buf = await readFile(indexPath);
        const body = injectReload(indexPath, buf.toString('utf-8'));
        writeNoStore(res, 200, 'text/html; charset=utf-8');
        res.end(body);
        return;
      }
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const buf = await readFile(filePath);
    const type = contentType(filePath);
    writeNoStore(res, 200, type);

    if (type.startsWith('text/html')) {
      res.end(injectReload(filePath, buf.toString('utf-8')));
    } else {
      res.end(buf);
    }
  } catch (e) {
    writeNoStore(res, 500, 'text/plain; charset=utf-8');
    res.end(`Server error: ${e?.message || String(e)}`);
  }
});

function writeNoStore(res, statusCode, type) {
  res.writeHead(statusCode, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
  });
}

function injectReload(filePath, html) {
  if (!filePath.endsWith('.html')) return html;
  if (html.includes('/__ws')) return html;
  if (html.includes('</body>')) return html.replace('</body>', `${reloadClient}</body>`);
  return html + reloadClient;
}

const wss = new WebSocketServer({ noServer: true });
const sockets = new Set();

wss.on('connection', (ws) => {
  sockets.add(ws);
  ws.on('close', () => sockets.delete(ws));
});

server.on('upgrade', (req, socket, head) => {
  if (!req.url || !req.url.startsWith('/__ws')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const watcher = chokidar.watch(
  [
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'styles.css'),
    path.join(ROOT, 'theme.css'),
    path.join(ROOT, 'assets.css'),
    path.join(ROOT, 'app.js'),
    path.join(ROOT, 'effects.js'),
    path.join(ROOT, 'assets/**/*')
  ],
  { ignoreInitial: true }
);

watcher.on('all', () => {
  for (const ws of sockets) {
    try { ws.send('reload'); } catch { /* ignore */ }
  }
});

function start(port) {
  server.listen(port, HOST, () => {
    console.log(`Dev server running at http://${HOST}:${port}`);
    if (process.env.WEB_HOST) {
      console.log(`Workstations preview: https://${process.env.WEB_HOST}/`);
    }
    console.log('Live reload enabled; caching disabled (no-store).');
  });
}

server.on('error', (err) => {
  if (err && err.code === 'EACCES' && PORT < 1024) {
    console.warn(`Port ${PORT} requires elevated permissions; falling back to 8080.`);
    start(8080);
    return;
  }
  throw err;
});

start(PORT);
