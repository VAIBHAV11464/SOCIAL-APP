import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
export const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

export function createApp(databasePath = process.env.DB_PATH || join(root, 'data', 'social.db')) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`);

  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  const readBody = async (req) => {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16384) {
        const error = new Error('Your message is too large.');
        error.status = 413;
        throw error;
      }
    }
    try { return JSON.parse(body || '{}'); }
    catch { const error = new Error('Send valid JSON.'); error.status = 400; throw error; }
  };
  const text = (value, label, max) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
      const error = new Error(`${label} must contain 1 to ${max} characters.`);
      error.status = 400;
      throw error;
    }
    return value.trim();
  };

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, { status: 'ok', version: release.version });
      if (req.method === 'GET' && pathname === '/api/config') return json(res, 200, release);
      if (req.method === 'GET' && pathname === '/api/posts') {
        return json(res, 200, db.prepare('SELECT * FROM posts ORDER BY id DESC').all());
      }
      if (req.method === 'POST' && pathname === '/api/posts') {
        const body = await readBody(req);
        const author = text(body.author, 'Name', 40);
        const content = text(body.content, 'Post', 500);
        const result = db.prepare('INSERT INTO posts (author, content, created_at) VALUES (?, ?, ?)').run(author, content, new Date().toISOString());
        return json(res, 201, db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid));
      }
      if (req.method === 'GET' && assets.has(pathname)) {
        const [filename, type] = assets.get(pathname);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        return res.end(readFileSync(join(root, 'public', filename)));
      }
      return json(res, 404, { error: 'That page or action is not available in this version.' });
    } catch (error) {
      if (!error.status) console.error(error);
      return json(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file:///${process.argv[1].replaceAll('\\', '/').replace(/^\//, '')}`))) {
  const port = Number(process.env.PORT || 3000);
  const server = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Social App ${release.version} is ready at http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
