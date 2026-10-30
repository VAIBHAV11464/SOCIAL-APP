const $ = (selector, root = document) => root.querySelector(selector);
const form = $('#post-form');
const feed = $('#feed');
const emptyState = feed.firstElementChild.cloneNode(true);
const author = $('#author');
const content = $('#content');
let release;
let noticeTimer;

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not complete that action.');
  return data;
}
function notify(message, error = false) {
  const notice = $('#notice');
  notice.textContent = message;
  notice.hidden = false;
  notice.classList.toggle('error', error);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}
function rememberName() { try { localStorage.setItem('social-name', author.value); } catch {} }
try { author.value = localStorage.getItem('social-name') || ''; } catch {}
author.addEventListener('change', rememberName);
content.addEventListener('input', () => { $('#character-count').textContent = `${content.value.length} / 500`; });

async function refreshFeed() {
  const posts = await api('/api/posts');
  feed.replaceChildren();
  $('#post-count').textContent = `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`;
  if (!posts.length) feed.append(emptyState.cloneNode(true));
  for (const post of posts) {
    const article = $('#post-template').content.firstElementChild.cloneNode(true);
    $('.post-avatar', article).textContent = post.author.slice(0, 1).toUpperCase();
    $('.post-author', article).textContent = post.author;
    $('.post-content', article).textContent = post.content;
    const date = $('.post-date', article);
    date.dateTime = post.created_at;
    date.textContent = new Date(post.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    feed.append(article);
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/posts', { method: 'POST', body: JSON.stringify({ author: author.value, content: content.value }) });
    rememberName();
    content.value = '';
    $('#character-count').textContent = '0 / 500';
    await refreshFeed();
    notify('Your update has been shared.');
  } catch (error) { notify(error.message, true); }
  finally { button.disabled = false; }
});

try {
  release = await api('/api/config');
  $('#version').textContent = `${release.version} · Share updates`;
  $('#footer-version').textContent = `Social App / ${release.version}`;
  await refreshFeed();
} catch (error) { notify('Could not load the feed. Please refresh and try again.', true); }
