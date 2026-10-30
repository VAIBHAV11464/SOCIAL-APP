const $ = (selector, root = document) => root.querySelector(selector);

const form = $('#post-form');

const feed = $('#feed');

const emptyState = feed.firstElementChild.cloneNode(true);

const author = $('#author');

const content = $('#content');

const clientId = (() => {

  let id;

  try { id = localStorage.getItem('social-client-id'); } catch {}

  if (!id) { id = crypto.randomUUID(); try { localStorage.setItem('social-client-id', id); } catch {} }

  return id;

})();

let release;

let noticeTimer;



async function api(path, options = {}) {

  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId, ...options.headers } });

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

    const likeButton = $('.like-button', article);

    let liked = Boolean(post.liked);

    const showLike = (count, value) => {

      liked = value;

      likeButton.classList.toggle('liked', value);

      likeButton.setAttribute('aria-pressed', String(value));

      $('.like-label', article).textContent = `${value ? 'Liked' : 'Like'}${count ? ` \u00b7 ${count}` : ''}`;

    };

    showLike(post.like_count, liked);

    likeButton.addEventListener('click', async () => {

      likeButton.disabled = true;

      try {

        const result = await api(`/api/posts/${post.id}/like`, { method: 'POST', body: JSON.stringify({ clientId, liked: !liked }) });

        showLike(result.like_count, result.liked);

      } catch (error) { notify(error.message, true); }

      finally { likeButton.disabled = false; }

    });

    article.dataset.postId = post.id;
    const commentToggle = $('.comment-toggle', article);
    const commentSection = $('.comment-section', article);
    const comments = post.comments || [];
    $('.comment-label', article).textContent = `Comment${comments.length ? ` \u00b7 ${comments.length}` : ''}`;
    const expandComments = (open) => {
      commentSection.hidden = !open;
      commentToggle.setAttribute('aria-expanded', String(open));
    };
    expandComments(comments.length > 0);
    commentToggle.addEventListener('click', () => {
      expandComments(commentSection.hidden);
      if (!commentSection.hidden) $('.comment-input', article).focus();
    });
    for (const comment of comments) {
      const entry = document.createElement('div');
      entry.className = 'comment';
      const meta = document.createElement('div');
      meta.className = 'comment-meta';
      const name = document.createElement('span');
      name.className = 'comment-author';
      name.textContent = comment.author;
      const time = document.createElement('time');
      time.className = 'comment-time';
      time.dateTime = comment.created_at;
      time.textContent = new Date(comment.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      meta.append(name, time);
      const body = document.createElement('p');
      body.textContent = comment.content;
      entry.append(meta, body);
      $('.comment-list', article).append(entry);
    }
    const commentForm = $('.comment-form', article);
    const commentInput = $('.comment-input', article);
    commentInput.id = `comment-${post.id}`;
    $('label', commentForm).htmlFor = commentInput.id;
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!author.value.trim()) { notify('Add your name above before replying.', true); author.focus(); return; }
      if (!commentForm.reportValidity()) return;
      const submit = $('button', commentForm);
      submit.disabled = true;
      try {
        await api(`/api/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ author: author.value, content: commentInput.value }) });
        rememberName();
        await refreshFeed();
        notify('Your reply has been added.');
      } catch (error) { notify(error.message, true); }
      finally { submit.disabled = false; }
    });
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

  $('#version').textContent = `${release.version} · Posts + likes + comments`;

  $('#footer-version').textContent = `Social App / ${release.version}`;

  await refreshFeed();

} catch (error) { notify('Could not load the feed. Please refresh and try again.', true); }

