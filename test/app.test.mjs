import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp, release } from '../server.mjs';

let server, base;
const temporary = mkdtempSync(join(tmpdir(), 'social-test-'));
const database = join(temporary, 'test.db');
async function start() { server = createApp(database); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; }
async function stop() { server.close(); server.closeAllConnections(); await once(server, 'close'); }
async function request(path, data) { const res = await fetch(base + path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return { status: res.status, body: await res.json() }; }
before(start);
after(async () => { await stop(); rmSync(temporary, { recursive: true, force: true }); });

test('health and release identify the deployed version', async () => {
  assert.deepEqual((await request('/health')).body, { status: 'ok', version: release.version });
  assert.deepEqual((await request('/api/config')).body, release);
});
test('the feed starts empty and accepts a new post', async () => {
  assert.deepEqual((await request('/api/posts')).body, []);
  const created = await request('/api/posts', { author: 'Vaibhav', content: 'My first update' });
  assert.equal(created.status, 201);
  assert.equal(created.body.content, 'My first update');
  assert.equal((await request('/api/posts')).body.length, 1);
});
test('blank names, blank posts, oversized posts and invalid JSON are rejected', async () => {
  for (const data of [{ author: ' ', content: 'Hello' }, { author: 'Vaibhav', content: ' ' }, { author: 'Vaibhav', content: 'a'.repeat(501) }]) assert.equal((await request('/api/posts', data)).status, 400);
  const res = await fetch(base + '/api/posts', { method: 'POST', body: '{bad json' });
  assert.equal(res.status, 400);
});
test('SQL metacharacters are stored as ordinary post text', async () => {
  const content = "It's a good day!'); DROP TABLE posts;--";
  assert.equal((await request('/api/posts', { author: 'Tester', content })).body.content, content);
  assert.equal((await request('/api/posts')).status, 200);
});
test('posts survive an application restart', async () => {
  const posts = (await request('/api/posts')).body;
  await stop(); await start();
  assert.deepEqual((await request('/api/posts')).body, posts);
});
test('unsupported versions of actions and filesystem paths return 404', async () => {
  if (!release.features.likes) assert.equal((await request('/api/posts/1/like', {})).status, 404);
  assert.equal((await request('/api/posts/1/comments', {})).status, 404);
  const res = await fetch(base + '/package.json');
  assert.equal(res.status, 404);
});

test('likes are idempotent for one browser and can be removed', async () => {
  const post = (await request('/api/posts', { author: 'Tester', content: 'Like this update' })).body;
  const path = `/api/posts/${post.id}/like`;
  const data = { clientId: 'browser-test-111111', liked: true };
  assert.equal((await request(path, data)).body.like_count, 1);
  assert.equal((await request(path, data)).body.like_count, 1);
  assert.equal((await request(path, { ...data, liked: false })).body.like_count, 0);
  assert.equal((await request(path, { ...data, liked: false })).body.like_count, 0);
});
test('likes from different browsers are counted and persist after restart', async () => {
  const post = (await request('/api/posts', { author: 'Tester', content: 'A community update' })).body;
  const path = `/api/posts/${post.id}/like`;
  await request(path, { clientId: 'browser-test-222222', liked: true });
  await request(path, { clientId: 'browser-test-333333', liked: true });
  await stop(); await start();
  const posts = (await request('/api/posts')).body;
  assert.equal(posts.find(p => p.id === post.id).like_count, 2);
});
test('invalid likes and unknown posts are rejected', async () => {
  assert.equal((await request('/api/posts/1/like', {})).status, 400);
  assert.equal((await request('/api/posts/999999/like', { clientId: 'browser-test-444444', liked: true })).status, 404);
});
