#!/usr/bin/env node
/* Build the static HTML pages for Local Lee from a single shared shell.
 * Run: node scripts/build-pages.js
 * Pages already hand-written (index, about) are not touched here.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', 'public');

const BRAND_IMG = `<img class="brand-mark" src="/brand-mark" alt="" width="44" height="44">`;

const HEADER = `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Local Lee home">
        ${BRAND_IMG}
        <span><span class="brand-name">Local Lee</span><br><span class="brand-tag">Lee County, Illinois</span></span>
      </a>
      <nav class="primary" aria-label="Primary">
        <a href="/about">About</a>
        <a href="/directory">Directory</a>
        <a href="/events">Events</a>
        <a href="/literature">Literature</a>
        <a href="/mutual-aid">Mutual Aid</a>
        <a href="/newsletter">Newsletter</a>
        <a href="/discussion">Discussion</a>
        <a href="/donate">Donate</a>
        <a href="/contact">Contact</a>
      </nav>
      <div class="nav-account" id="nav-account" aria-live="polite"></div>
    </div>
  </header>`;

const FOOTER = `<footer class="site-footer">
    <div class="footer-inner">
      <div>
        <h4>Local Lee</h4>
        <p>A neighborly network for Lee County, Illinois - Dixon, Amboy, Ashton, Compton, Franklin Grove, Lee Center, Paw Paw, Sublette, West Brooklyn, Harmon, Nelson, Steward, and the country in between.</p>
      </div>
      <div>
        <h4>Around the site</h4>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/directory">Business directory</a></li>
          <li><a href="/events">Events</a></li>
          <li><a href="/literature">Literature</a></li>
          <li><a href="/mutual-aid">Mutual aid</a></li>
          <li><a href="/newsletter">Newsletter</a></li>
          <li><a href="/discussion">Discussion</a></li>
          <li><a href="/donate">Donate</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Pitch in</h4>
        <ul>
          <li><a href="/submit/business">List a business</a></li>
          <li><a href="/submit/event">Post an event</a></li>
          <li><a href="/submit/book">Suggest a book</a></li>
          <li><a href="/submit/aid-post">Post a need or offer</a></li>
          <li><a href="/newsletter/suggest">Suggest a newsletter topic</a></li>
        </ul>
      </div>
    </div>
    <p class="fine-print">© <span id="year"></span> Local Lee - Lee County, Illinois. <a href="mailto:contact@locallee.org">contact@locallee.org</a></p>
  </footer>`;

// AltCha widget (v3). The attribute is "challenge" (URL string), not
// "challengeurl" (that was v2), and footer/logo hiding is done via the
// "configuration" attribute as JSON. auto="onload" kicks off the
// proof-of-work as soon as the page renders so the hidden "altcha"
// input is already populated by the time the visitor submits.
const ALTCHA = `<noscript><div class="notice">JavaScript is required to submit this form.</div></noscript>
      <altcha-widget class="altcha" challenge="/api/altcha/challenge" auto="onload" configuration='{"hideFooter":true}' strings='{"verified":"Verified","verifying":"Checking...","label":"Verifying you are a neighbor and not a bot..."}'></altcha-widget>`;

function shell(opts) {
  const {
    title,
    description,
    canonical,
    main,
    extraHead = '',
    extraScript = '',
    bodyClass = '',
    narrow = false,
    altcha = false,
  } = opts;
  const altchaScript = altcha
    ? '<script src="/js/altcha.min.js" defer></script>'
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://locallee.org${canonical}">
  <link rel="stylesheet" href="/css/style.css">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://locallee.org${canonical}">
  <meta property="og:site_name" content="Local Lee">
  <meta name="twitter:card" content="summary">
  ${altchaScript}
  ${extraHead}
</head>
<body${bodyClass ? ' class="' + bodyClass + '"' : ''}>
  ${HEADER}

  <main id="main"${narrow ? ' class="narrow"' : ''}>
${main}
  </main>

  ${FOOTER}

  <script src="/js/main.js"></script>
  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
  ${extraScript}
</body>
</html>
`;
}

const pages = {};

// ----- Contact -----
pages['contact.html'] = shell({
  altcha: true,
  title: 'Contact - Local Lee',
  description: 'Get in touch with Local Lee - corrections, suggestions, or a hand with the editing.',
  canonical: '/contact',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Get in touch</h1>
      <p>Corrections, suggestions, or an offer to help - we read everything that comes in.</p>
    </div>

    <p>You can reach us by email at <a href="mailto:contact@locallee.org">contact@locallee.org</a>, or use the form below.</p>

    <form id="contact-form" class="card" novalidate>
      <div class="form-row">
        <label for="c-name">Your name</label>
        <input id="c-name" name="name" type="text" required maxlength="120">
      </div>
      <div class="form-row">
        <label for="c-email">Email <span class="dim small">(optional, if you'd like a reply)</span></label>
        <input id="c-email" name="email" type="email" maxlength="254">
      </div>
      <div class="form-row">
        <label for="c-message">Message</label>
        <textarea id="c-message" name="message" rows="6" required maxlength="4000"></textarea>
      </div>
      ${ALTCHA}
      <button type="submit" class="btn">Send</button>
      <div id="c-notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      try {
        await LL.api('/api/contact', {
          method: 'POST',
          body: {
            name: f.name.value,
            email: f.email.value,
            message: f.message.value,
            altcha: f.elements.altcha ? f.elements.altcha.value : '',
          },
        });
        LL.notice('#c-notice', 'Thank you - we\\'ll be in touch.', 'success');
        f.reset();
      } catch (err) {
        LL.notice('#c-notice', err.message, 'error');
      }
    });
  </script>`,
});

// ----- Business Directory (list) -----
pages['directory.html'] = shell({
  title: 'Business Directory - Local Lee',
  description: 'A directory of locally owned businesses across Lee County, Illinois - farms, shops, trades, eateries, and more. Browse by category or town, or submit your own.',
  canonical: '/directory',
  main: `    <div class="page-head">
      <h1>The Local Lee directory</h1>
      <p>Locally owned businesses across Lee County. Know one we're missing? <a href="/submit/business">Add it.</a></p>
    </div>

    <form class="filters" id="filters" aria-label="Filter businesses">
      <div class="form-row">
        <label for="f-category">Category</label>
        <select id="f-category" name="category"><option value="">All categories</option></select>
      </div>
      <div class="form-row">
        <label for="f-town">Town</label>
        <select id="f-town" name="town">
          <option value="">All towns</option>
          <option>Dixon</option><option>Amboy</option><option>Ashton</option>
          <option>Compton</option><option>Franklin Grove</option><option>Lee Center</option>
          <option>Paw Paw</option><option>Sublette</option><option>West Brooklyn</option>
          <option>Harmon</option><option>Nelson</option><option>Steward</option>
        </select>
      </div>
      <div class="form-row">
        <label for="f-q">Search</label>
        <input id="f-q" name="q" type="search" placeholder="name or keyword">
      </div>
      <button type="submit" class="btn">Filter</button>
      <a class="btn btn-secondary" href="/submit/business">Add a business</a>
    </form>

    <div id="biz-list" class="card-grid" aria-busy="true"></div>`,
  extraScript: `<script>
    const params = new URLSearchParams(location.search);
    document.getElementById('f-category').value = params.get('category') || '';
    document.getElementById('f-town').value = params.get('town') || '';
    document.getElementById('f-q').value = params.get('q') || '';

    async function loadCategories() {
      const { categories } = await LL.api('/api/categories');
      const sel = document.getElementById('f-category');
      const parents = categories.filter(c => !c.parent_id);
      for (const p of parents) {
        const opt = document.createElement('option');
        opt.value = p.slug; opt.textContent = p.name;
        sel.appendChild(opt);
        const kids = categories.filter(c => c.parent_id === p.id);
        for (const k of kids) {
          const o = document.createElement('option');
          o.value = k.slug; o.textContent = '   - ' + k.name;
          sel.appendChild(o);
        }
      }
      sel.value = params.get('category') || '';
    }

    async function loadBusinesses() {
      const list = document.getElementById('biz-list');
      list.setAttribute('aria-busy', 'true');
      const q = new URLSearchParams();
      const cat = document.getElementById('f-category').value;
      const town = document.getElementById('f-town').value;
      const search = document.getElementById('f-q').value.trim();
      if (cat) q.set('category', cat);
      if (town) q.set('town', town);
      if (search) q.set('q', search);
      try {
        const { businesses } = await LL.api('/api/businesses?' + q.toString());
        if (!businesses.length) {
          list.innerHTML = '<p class="dim">No businesses match these filters yet.</p>';
        } else {
          list.innerHTML = businesses.map(b =>
            \`<article class="card">
              <h3><a href="/directory/\${LL.escape(b.slug)}">\${LL.escape(b.name)}</a></h3>
              <div class="meta">\${b.category_name ? LL.escape(b.category_name) : ''}\${b.town ? ' · ' + LL.escape(b.town) : ''}</div>
              <p>\${LL.escape((b.description || '').slice(0, 200))}\${(b.description || '').length > 200 ? '…' : ''}</p>
            </article>\`).join('');
        }
      } catch (err) {
        list.innerHTML = '<p class="dim">Couldn\\'t load businesses.</p>';
      }
      list.setAttribute('aria-busy', 'false');
    }

    document.getElementById('filters').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = new URLSearchParams();
      const cat = document.getElementById('f-category').value;
      const town = document.getElementById('f-town').value;
      const search = document.getElementById('f-q').value.trim();
      if (cat) q.set('category', cat);
      if (town) q.set('town', town);
      if (search) q.set('q', search);
      history.replaceState(null, '', '/directory' + (q.toString() ? '?' + q : ''));
      loadBusinesses();
    });

    loadCategories().then(loadBusinesses);
  </script>`,
});

// ----- Single business page -----
pages['business.html'] = shell({
  title: 'Business - Local Lee',
  description: 'A locally owned business in Lee County, Illinois.',
  canonical: '/directory',
  main: `    <article id="biz" aria-busy="true">
      <p class="dim">Loading…</p>
    </article>`,
  extraScript: `<script>
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('biz');
    (async () => {
      try {
        const { business: b } = await LL.api('/api/businesses/' + encodeURIComponent(slug));
        document.title = b.name + ' - Local Lee';
        const ld = {
          '@context': 'https://schema.org', '@type': 'LocalBusiness',
          name: b.name, description: b.description || undefined,
          telephone: b.phone || undefined, email: b.email || undefined,
          url: b.website || undefined,
          address: b.address ? { '@type': 'PostalAddress', streetAddress: b.address, addressLocality: b.town || undefined, addressRegion: 'IL' } : undefined
        };
        const ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.textContent = JSON.stringify(ld);
        document.head.appendChild(ldEl);
        root.innerHTML = \`
          <div class="page-head">
            <p class="small dim"><a href="/directory">← Directory</a>\${b.category_slug ? ' · <a href="/directory?category=' + LL.escape(b.category_slug) + '">' + LL.escape(b.category_name) + '</a>' : ''}</p>
            <h1>\${LL.escape(b.name)}</h1>
            <p>\${b.town ? LL.escape(b.town) + ' · ' : ''}\${b.claim_status === 'claimed' ? '<span class="tag">Owner-verified</span>' : ''}</p>
          </div>
          <div class="two-col">
            <div class="prose">
              <p>\${LL.escape(b.description || '')}</p>
              \${b.hours ? '<p><strong>Hours:</strong> ' + LL.escape(b.hours) + '</p>' : ''}
            </div>
            <aside class="card">
              <h3>Contact</h3>
              \${b.address ? '<p>' + LL.escape(b.address) + '</p>' : ''}
              \${b.phone ? '<p>📞 <a href="tel:' + LL.escape(b.phone) + '">' + LL.escape(b.phone) + '</a></p>' : ''}
              \${b.email ? '<p>✉ <a href="mailto:' + LL.escape(b.email) + '">' + LL.escape(b.email) + '</a></p>' : ''}
              \${b.website ? '<p>🌐 <a href="' + LL.escape(b.website) + '" rel="noopener">' + LL.escape(b.website) + '</a></p>' : ''}
              <hr>
              <p class="small">Are you the owner? <button type="button" class="btn btn-secondary" id="claim-btn">Claim this listing</button></p>
              <div id="claim-msg" class="notice small" hidden></div>
            </aside>
          </div>
        \`;
        document.getElementById('claim-btn').addEventListener('click', async () => {
          try {
            await LL.api('/api/businesses/' + b.id + '/claim', { method: 'POST' });
            LL.notice('#claim-msg', 'Claim submitted - an editor will follow up to verify.', 'success');
          } catch (err) {
            LL.notice('#claim-msg', err.message, 'error');
          }
        });
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">This business could not be found. <a href="/directory">Back to the directory.</a></p>';
        root.setAttribute('aria-busy', 'false');
      }
    })();
  </script>`,
});

// ----- Events list -----
pages['events.html'] = shell({
  title: 'Events - Local Lee',
  description: 'Upcoming community events in Lee County, Illinois - church suppers, farmers markets, school plays, work parties, and more. Anyone can submit.',
  canonical: '/events',
  main: `    <div class="page-head">
      <h1>What's coming up</h1>
      <p>Approved community events across the county. <a href="/submit/event">Post yours →</a></p>
    </div>

    <ul class="row-list" id="events" aria-busy="true">
      <li class="dim">Loading…</li>
    </ul>`,
  extraScript: `<script>
    (async () => {
      const list = document.getElementById('events');
      try {
        const { events } = await LL.api('/api/events');
        if (!events.length) {
          list.innerHTML = '<li class="dim">No events on the books yet - <a href="/submit/event">post the first one</a>.</li>';
        } else {
          list.innerHTML = events.map(e => \`
            <li>
              <h3 style="margin:0"><a href="/events/\${LL.escape(e.slug)}">\${LL.escape(e.title)}</a></h3>
              <div class="meta">\${LL.escape(LL.formatDate(e.starts_at))}\${e.town ? ' · ' + LL.escape(e.town) : ''}\${e.location ? ' · ' + LL.escape(e.location) : ''} · <strong>\${e.rsvp_count} going</strong></div>
              \${e.description ? '<p>' + LL.escape(e.description.slice(0, 240)) + (e.description.length > 240 ? '…' : '') + '</p>' : ''}
            </li>\`).join('');
        }
      } catch (err) {
        list.innerHTML = '<li class="dim">Couldn\\'t load events.</li>';
      }
      list.setAttribute('aria-busy', 'false');
    })();
  </script>`,
});

// ----- Single event -----
pages['event.html'] = shell({
  title: 'Event - Local Lee',
  description: 'A community event in Lee County, Illinois.',
  canonical: '/events',
  main: `    <article id="event" aria-busy="true"><p class="dim">Loading…</p></article>`,
  extraScript: `<script>
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('event');
    let evt = null, rsvped = false;

    function render() {
      const e = evt;
      const ld = {
        '@context': 'https://schema.org', '@type': 'Event',
        name: e.title,
        startDate: new Date(e.starts_at * 1000).toISOString(),
        endDate: e.ends_at ? new Date(e.ends_at * 1000).toISOString() : undefined,
        location: e.location ? { '@type': 'Place', name: e.location, address: { '@type': 'PostalAddress', addressLocality: e.town || undefined, addressRegion: 'IL' } } : undefined,
        description: e.description || undefined,
        organizer: e.organizer ? { '@type': 'Organization', name: e.organizer } : undefined,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled'
      };
      const ldEl = document.createElement('script');
      ldEl.type = 'application/ld+json';
      ldEl.textContent = JSON.stringify(ld);
      document.head.appendChild(ldEl);

      document.title = e.title + ' - Local Lee';
      root.innerHTML = \`
        <div class="page-head">
          <p class="small dim"><a href="/events">← All events</a></p>
          <h1>\${LL.escape(e.title)}</h1>
          <p>\${LL.escape(LL.formatDate(e.starts_at))}\${e.ends_at ? ' – ' + LL.escape(LL.formatDate(e.ends_at)) : ''}</p>
        </div>
        <div class="two-col">
          <div class="prose">
            <p>\${LL.escape(e.description || '')}</p>
          </div>
          <aside class="card">
            <h3>Details</h3>
            \${e.location ? '<p><strong>Where:</strong> ' + LL.escape(e.location) + '</p>' : ''}
            \${e.town ? '<p><strong>Town:</strong> ' + LL.escape(e.town) + '</p>' : ''}
            \${e.organizer ? '<p><strong>Hosted by:</strong> ' + LL.escape(e.organizer) + '</p>' : ''}
            \${e.contact ? '<p><strong>Contact:</strong> ' + LL.escape(e.contact) + '</p>' : ''}
            <p><strong id="rsvp-count">\${e.rsvp_count}</strong> going</p>
            <button type="button" class="btn btn-field" id="rsvp-btn"\${rsvped ? ' disabled' : ''}>\${rsvped ? "You're going" : "I'm going"}</button>
            <div id="rsvp-msg" class="notice small" hidden></div>
          </aside>
        </div>
      \`;
      const btn = document.getElementById('rsvp-btn');
      if (btn) btn.addEventListener('click', async () => {
        try {
          const { count } = await LL.api('/api/events/' + e.id + '/rsvp', { method: 'POST' });
          document.getElementById('rsvp-count').textContent = count;
          btn.disabled = true; btn.textContent = "You're going";
          LL.notice('#rsvp-msg', "We'll see you there.", 'success');
        } catch (err) {
          LL.notice('#rsvp-msg', err.message, 'error');
        }
      });
    }

    (async () => {
      try {
        const data = await LL.api('/api/events/' + encodeURIComponent(slug));
        evt = data.event; rsvped = data.rsvped;
        render();
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">Event not found. <a href="/events">Back to events.</a></p>';
        root.setAttribute('aria-busy', 'false');
      }
    })();
  </script>`,
});

// ----- Literature list -----
pages['literature.html'] = shell({
  title: 'Literature - Local Lee',
  description: 'A curated reading list on neighborhood, place, and household life - plus reader-suggested books, with room for discussion.',
  canonical: '/literature',
  main: `    <div class="page-head">
      <h1>The Local Lee reading list</h1>
      <p>Books on neighborhood, place, and household economy. <a href="/submit/book">Suggest one →</a></p>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="true" data-which="curated">Curated</button>
      <button class="tab" role="tab" aria-selected="false" data-which="suggested">Reader-suggested</button>
      <button class="tab" role="tab" aria-selected="false" data-which="all">All</button>
    </div>

    <div id="books" class="card-grid" aria-busy="true"></div>`,
  extraScript: `<script>
    let allBooks = [];
    function render(which) {
      const list = document.getElementById('books');
      list.setAttribute('aria-busy', 'true');
      let books = allBooks;
      if (which === 'curated') books = allBooks.filter(b => b.curated);
      if (which === 'suggested') books = allBooks.filter(b => !b.curated);
      if (!books.length) {
        list.innerHTML = '<p class="dim">No books here yet.</p>';
      } else {
        list.innerHTML = books.map(b => \`
          <article class="card">
            <h3><a href="/literature/\${LL.escape(b.slug)}">\${LL.escape(b.title)}</a></h3>
            <div class="meta">\${b.author ? LL.escape(b.author) : 'Unknown author'}\${b.year ? ' · ' + LL.escape(b.year) : ''}\${b.curated ? ' · <span class="tag">Curated</span>' : ' · <span class="tag">Reader pick</span>'}</div>
            <p>\${LL.escape((b.description || '').slice(0, 240))}\${(b.description || '').length > 240 ? '…' : ''}</p>
          </article>\`).join('');
      }
      list.setAttribute('aria-busy', 'false');
    }
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', 'false'));
        t.setAttribute('aria-selected', 'true');
        render(t.dataset.which);
      });
    });
    (async () => {
      try {
        const { books } = await LL.api('/api/books');
        allBooks = books;
        render('curated');
      } catch (err) {
        document.getElementById('books').innerHTML = '<p class="dim">Couldn\\'t load books.</p>';
      }
    })();
  </script>`,
});

// ----- Single book page -----
pages['book.html'] = shell({
  altcha: true,
  title: 'Book - Local Lee',
  description: 'A book on the Local Lee reading list.',
  canonical: '/literature',
  main: `    <article id="book" aria-busy="true"><p class="dim">Loading…</p></article>
    <section id="comments-section" hidden>
      <h2>Discussion</h2>
      <ul class="row-list" id="comments"></ul>
      <form id="comment-form" class="card" hidden>
        <div class="form-row">
          <label for="c-body">Add to the conversation</label>
          <textarea id="c-body" name="body" rows="4" maxlength="4000" required></textarea>
        </div>
        ${ALTCHA}
      <button type="submit" class="btn">Post comment</button>
        <div id="c-notice" class="notice small" hidden></div>
      </form>
      <p id="comment-signin" class="dim" hidden><a href="/login">Sign in</a> or <a href="/register">join</a> to comment.</p>
    </section>`,
  extraScript: `<script>
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('book');
    let book = null;

    function renderComments(comments) {
      const ul = document.getElementById('comments');
      if (!comments.length) {
        ul.innerHTML = '<li class="dim">No comments yet.</li>';
        return;
      }
      ul.innerHTML = comments.map(c => \`
        <li>
          <div class="meta"><strong>\${LL.escape(c.display_name || c.email.split('@')[0])}</strong> · \${LL.escape(LL.formatDate(c.created_at))}</div>
          <p>\${LL.escape(c.body)}</p>
        </li>\`).join('');
    }

    async function loadAll() {
      try {
        const { book: b, comments } = await LL.api('/api/books/' + encodeURIComponent(slug));
        book = b;
        document.title = b.title + ' - Local Lee';
        const ld = {
          '@context': 'https://schema.org', '@type': 'Book',
          name: b.title, author: b.author ? { '@type': 'Person', name: b.author } : undefined,
          datePublished: b.year || undefined, description: b.description || undefined
        };
        const ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.textContent = JSON.stringify(ld);
        document.head.appendChild(ldEl);
        root.innerHTML = \`
          <div class="page-head">
            <p class="small dim"><a href="/literature">← Reading list</a></p>
            <h1>\${LL.escape(b.title)}</h1>
            <p>\${b.author ? LL.escape(b.author) : 'Unknown author'}\${b.year ? ' · ' + LL.escape(b.year) : ''}\${b.curated ? ' · <span class="tag">Curated</span>' : ' · <span class="tag">Reader pick</span>'}</p>
          </div>
          <div class="prose">
            \${b.description ? '<p>' + LL.escape(b.description) + '</p>' : ''}
            \${b.why_we_read ? '<h3>Why it\\'s on the list</h3><blockquote>' + LL.escape(b.why_we_read) + '</blockquote>' : ''}
          </div>
        \`;
        renderComments(comments);
        document.getElementById('comments-section').hidden = false;
        const me = (await LL.api('/api/me')).user;
        if (me) document.getElementById('comment-form').hidden = false;
        else document.getElementById('comment-signin').hidden = false;
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">Book not found. <a href="/literature">Back to the list.</a></p>';
      }
    }

    document.getElementById('comment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = document.getElementById('c-body').value.trim();
      if (!body) return;
      try {
        await LL.api('/api/books/' + book.id + '/comments', { method: 'POST', body: { body, altcha: e.currentTarget.elements.altcha ? e.currentTarget.elements.altcha.value : '' } });
        document.getElementById('c-body').value = '';
        const data = await LL.api('/api/books/' + encodeURIComponent(slug));
        renderComments(data.comments);
        LL.notice('#c-notice', 'Posted.', 'success');
      } catch (err) {
        LL.notice('#c-notice', err.message, 'error');
      }
    });

    loadAll();
  </script>`,
});

// ----- Mutual aid -----
pages['mutual-aid.html'] = shell({
  title: 'Mutual Aid - Local Lee',
  description: 'Mutual aid in Lee County, Illinois - a directory of food pantries, warming centers, and family resources, plus a community board of needs and offers, all reviewed before posting.',
  canonical: '/mutual-aid',
  main: `    <div class="page-head">
      <h1>Mutual aid in Lee County</h1>
      <p>A directory of pantries, warming centers, and family resources, plus a community board where neighbors post what they need and what they can offer. Posts are reviewed before they go live and refresh every thirty days.</p>
    </div>

    <div class="notice">
      <strong>How this works.</strong> An editor reviews every post before it appears. We don't host messaging here - when you reply to a post you're contacting a neighbor directly with the contact info they shared. Use ordinary good sense.
    </div>

    <div class="tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="true" data-which="resources">Resource directory</button>
      <button class="tab" role="tab" aria-selected="false" data-which="needs">Needs</button>
      <button class="tab" role="tab" aria-selected="false" data-which="offers">Offers</button>
    </div>

    <div id="panel-resources" class="panel">
      <p>Established organizations and ongoing programs serving Lee County. <a href="/submit/aid-resource">Suggest a resource →</a></p>
      <div id="resources" class="card-grid" aria-busy="true"></div>
    </div>

    <div id="panel-needs" class="panel" hidden>
      <p>Neighbors who could use a hand right now. <a href="/submit/aid-post?kind=need">Post a need →</a></p>
      <ul class="row-list" id="needs" aria-busy="true"></ul>
    </div>

    <div id="panel-offers" class="panel" hidden>
      <p>Neighbors offering a hand right now. <a href="/submit/aid-post?kind=offer">Post an offer →</a></p>
      <ul class="row-list" id="offers" aria-busy="true"></ul>
    </div>`,
  extraScript: `<script>
    function showPanel(which) {
      document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.which === which ? 'true' : 'false'));
      document.querySelectorAll('.panel').forEach(p => p.hidden = true);
      document.getElementById('panel-' + which).hidden = false;
    }
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showPanel(t.dataset.which)));

    function postCard(p) {
      const days = LL.daysUntil(p.expires_at);
      return \`<li>
        <div><span class="tag kind-\${p.kind}">\${p.kind === 'need' ? 'Need' : 'Offer'}</span>\${p.category ? ' <span class="tag">' + LL.escape(p.category) + '</span>' : ''}\${p.town ? ' <span class="tag">' + LL.escape(p.town) + '</span>' : ''} <span class="tag expires">\${days} day\${days === 1 ? '' : 's'} left</span></div>
        <h3 style="margin:0.3em 0 0"><a href="/mutual-aid/post/\${p.id}">\${LL.escape(p.title)}</a></h3>
        <p>\${LL.escape(p.body.slice(0, 280))}\${p.body.length > 280 ? '…' : ''}</p>
        <div class="meta">\${p.contact_name ? 'Posted by ' + LL.escape(p.contact_name) + ' · ' : ''}\${LL.escape(LL.formatDate(p.created_at))}</div>
      </li>\`;
    }

    (async () => {
      try {
        const { resources } = await LL.api('/api/aid/resources');
        const grouped = {};
        for (const r of resources) (grouped[r.category] = grouped[r.category] || []).push(r);
        const root = document.getElementById('resources');
        if (!resources.length) {
          root.innerHTML = '<p class="dim">No resources listed yet.</p>';
        } else {
          root.innerHTML = resources.map(r => \`
            <article class="card">
              <h3>\${LL.escape(r.name)}</h3>
              <div class="meta">\${LL.escape(r.category)}\${r.town ? ' · ' + LL.escape(r.town) : ''}</div>
              <p>\${LL.escape(r.description || '')}</p>
              \${r.address ? '<p class="small">' + LL.escape(r.address) + '</p>' : ''}
              \${r.phone ? '<p class="small">📞 ' + LL.escape(r.phone) + '</p>' : ''}
              \${r.website ? '<p class="small">🌐 <a href="' + LL.escape(r.website) + '" rel="noopener">' + LL.escape(r.website) + '</a></p>' : ''}
              \${r.hours ? '<p class="small"><strong>Hours:</strong> ' + LL.escape(r.hours) + '</p>' : ''}
            </article>\`).join('');
        }
        root.setAttribute('aria-busy', 'false');
      } catch (e) {
        document.getElementById('resources').innerHTML = '<p class="dim">Couldn\\'t load resources.</p>';
      }

      try {
        const { posts: needs } = await LL.api('/api/aid/posts?kind=need');
        const ul = document.getElementById('needs');
        ul.innerHTML = needs.length ? needs.map(postCard).join('') : '<li class="dim">No open needs right now.</li>';
        ul.setAttribute('aria-busy', 'false');
      } catch (e) {}

      try {
        const { posts: offers } = await LL.api('/api/aid/posts?kind=offer');
        const ul = document.getElementById('offers');
        ul.innerHTML = offers.length ? offers.map(postCard).join('') : '<li class="dim">No open offers right now.</li>';
        ul.setAttribute('aria-busy', 'false');
      } catch (e) {}
    })();
  </script>`,
});

// ----- Single aid post -----
pages['aid-post.html'] = shell({
  title: 'Mutual Aid Post - Local Lee',
  description: 'A community mutual-aid post in Lee County, Illinois.',
  canonical: '/mutual-aid',
  main: `    <article id="post" aria-busy="true"><p class="dim">Loading…</p></article>`,
  extraScript: `<script>
    const id = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('post');
    (async () => {
      try {
        const { post: p } = await LL.api('/api/aid/posts/' + encodeURIComponent(id));
        const days = LL.daysUntil(p.expires_at);
        document.title = p.title + ' - Local Lee';
        root.innerHTML = \`
          <div class="page-head">
            <p class="small dim"><a href="/mutual-aid">← Mutual aid</a></p>
            <h1>\${LL.escape(p.title)}</h1>
            <p><span class="tag kind-\${p.kind}">\${p.kind === 'need' ? 'Need' : 'Offer'}</span>\${p.category ? ' <span class="tag">' + LL.escape(p.category) + '</span>' : ''}\${p.town ? ' <span class="tag">' + LL.escape(p.town) + '</span>' : ''} <span class="tag expires">\${days} day\${days === 1 ? '' : 's'} left</span></p>
          </div>
          <div class="prose">
            <p>\${LL.escape(p.body)}</p>
          </div>
          <div class="card">
            <h3>How to reach \${LL.escape(p.contact_name || 'this neighbor')}</h3>
            <p>\${LL.escape(p.contact)}</p>
            <p class="small dim">Posted \${LL.escape(LL.formatDate(p.created_at))}. Posts on the mutual-aid board automatically come down 30 days after they're posted.</p>
          </div>
        \`;
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">Post not found or expired. <a href="/mutual-aid">Back to mutual aid.</a></p>';
      }
    })();
  </script>`,
});

// ----- Login -----
pages['login.html'] = shell({
  title: 'Sign in - Local Lee',
  description: 'Sign in to Local Lee to comment, claim a business, or post to the mutual-aid board.',
  canonical: '/login',
  main: `    <div class="auth-card">
      <h1>Sign in</h1>
      <form id="login-form" novalidate>
        <div class="form-row">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email">
        </div>
        <div class="form-row">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn">Sign in</button>
        <div id="notice" class="notice" hidden></div>
      </form>
      <p class="small dim" style="margin-top:1em">No account yet? <a href="/register">Join Local Lee.</a></p>
    </div>`,
  extraScript: `<script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      try {
        await LL.api('/api/login', {
          method: 'POST',
          body: { email: f.email.value, password: f.password.value }
        });
        const next = new URLSearchParams(location.search).get('next') || '/';
        location.href = next;
      } catch (err) {
        LL.notice('#notice', err.message, 'error');
      }
    });
  </script>`,
});

// ----- Register -----
pages['register.html'] = shell({
  altcha: true,
  title: 'Join - Local Lee',
  description: 'Create a free Local Lee account to comment, claim a listing, or post to the mutual-aid board.',
  canonical: '/register',
  main: `    <div class="auth-card">
      <h1>Join Local Lee</h1>
      <p class="dim small">Free, no tracking, no newsletters you didn't ask for.</p>
      <form id="reg-form" novalidate>
        <div class="form-row">
          <label for="display_name">Your name <span class="dim small">(or what neighbors call you)</span></label>
          <input id="display_name" name="display_name" type="text" maxlength="80" autocomplete="name">
        </div>
        <div class="form-row">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email">
        </div>
        <div class="form-row">
          <label for="password">Password <span class="dim small">(at least 8 characters)</span></label>
          <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password">
        </div>
        ${ALTCHA}
      <button type="submit" class="btn">Create account</button>
        <div id="notice" class="notice" hidden></div>
      </form>
      <p class="small dim" style="margin-top:1em">Already have one? <a href="/login">Sign in.</a></p>
    </div>`,
  extraScript: `<script>
    document.getElementById('reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      try {
        await LL.api('/api/register', {
          method: 'POST',
          body: {
            email: f.email.value,
            password: f.password.value,
            display_name: f.display_name.value,
            altcha: f.elements.altcha ? f.elements.altcha.value : '',
          }
        });
        location.href = '/';
      } catch (err) {
        LL.notice('#notice', err.message, 'error');
      }
    });
  </script>`,
});

// ----- Submit business -----
pages['submit-business.html'] = shell({
  altcha: true,
  title: 'List a business - Local Lee',
  description: 'Submit a locally owned Lee County business to the Local Lee directory. An editor reviews each submission before it appears.',
  canonical: '/submit/business',
  narrow: true,
  main: `    <div class="page-head">
      <h1>List a business</h1>
      <p>Submit a locally owned Lee County business. An editor will read it before it goes live.</p>
    </div>

    <div class="notice">
      <strong>What gets listed.</strong> Local Lee is a directory of <strong>locally owned, independent small businesses</strong> with a real presence in <strong>Lee County, Illinois</strong> (Dixon, Amboy, Ashton, Compton, Franklin Grove, Lee Center, Paw Paw, Sublette, West Brooklyn, Harmon, Nelson, Steward, and the surrounding rural areas). National chains, franchises, and out-of-county businesses will not be approved. If a business has multiple locations, only the Lee County one belongs here.
    </div>

    <form id="form" class="card" novalidate>
      <div class="form-row">
        <label for="name">Business name *</label>
        <input id="name" name="name" type="text" required maxlength="120">
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label for="category_id">Category *</label>
          <select id="category_id" name="category_id" required><option value="">- pick one -</option></select>
        </div>
        <div class="form-row">
          <label for="town">Town in Lee County *</label>
          <select id="town" name="town" required>
            <option value="">- pick one -</option>
            <option>Dixon</option><option>Amboy</option><option>Ashton</option>
            <option>Compton</option><option>Franklin Grove</option><option>Lee Center</option>
            <option>Paw Paw</option><option>Sublette</option><option>West Brooklyn</option>
            <option>Harmon</option><option>Nelson</option><option>Steward</option>
            <option>Other (rural Lee County)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label for="description">Description</label>
        <textarea id="description" name="description" rows="5" maxlength="4000"></textarea>
      </div>
      <div class="form-grid">
        <div class="form-row"><label for="address">Address</label><input id="address" name="address" type="text" maxlength="200"></div>
        <div class="form-row"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" maxlength="40"></div>
        <div class="form-row"><label for="email">Email</label><input id="email" name="email" type="email" maxlength="200"></div>
        <div class="form-row"><label for="website">Website</label><input id="website" name="website" type="url" maxlength="300"></div>
      </div>
      <div class="form-row">
        <label for="hours">Hours <span class="dim small">(plain text is fine)</span></label>
        <input id="hours" name="hours" type="text" maxlength="300" placeholder="Mon–Fri 8a–5p, Sat 9a–noon">
      </div>
      ${ALTCHA}
      <button type="submit" class="btn">Submit for review</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    (async () => {
      const { categories } = await LL.api('/api/categories');
      const sel = document.getElementById('category_id');
      const parents = categories.filter(c => !c.parent_id);
      for (const p of parents) {
        const og = document.createElement('optgroup');
        og.label = p.name;
        const kids = categories.filter(c => c.parent_id === p.id);
        for (const k of kids) {
          const o = document.createElement('option');
          o.value = k.id; o.textContent = k.name;
          og.appendChild(o);
        }
        sel.appendChild(og);
      }
    })();
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        await LL.api('/api/businesses', { method: 'POST', body });
        LL.notice('#notice', 'Thank you. An editor will review and post the listing.', 'success');
        f.reset();
      } catch (err) {
        LL.notice('#notice', err.message, 'error');
      }
    });
  </script>`,
});

// ----- Submit event -----
pages['submit-event.html'] = shell({
  altcha: true,
  title: 'Post an event - Local Lee',
  description: 'Submit a community event happening in Lee County, Illinois. An editor reviews each one before posting.',
  canonical: '/submit/event',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Post an event</h1>
      <p>Suppers, markets, work parties, school plays - anything happening in Lee County.</p>
    </div>

    <form id="form" class="card" novalidate>
      <div class="form-row"><label for="title">Title *</label><input id="title" name="title" type="text" required maxlength="160"></div>
      <div class="form-grid">
        <div class="form-row"><label for="starts_at">Starts *</label><input id="starts_at" name="starts_at" type="datetime-local" required></div>
        <div class="form-row"><label for="ends_at">Ends</label><input id="ends_at" name="ends_at" type="datetime-local"></div>
        <div class="form-row">
          <label for="town">Town</label>
          <select id="town" name="town">
            <option value="">- pick one -</option>
            <option>Dixon</option><option>Amboy</option><option>Ashton</option>
            <option>Compton</option><option>Franklin Grove</option><option>Lee Center</option>
            <option>Paw Paw</option><option>Sublette</option><option>West Brooklyn</option>
            <option>Harmon</option><option>Nelson</option><option>Steward</option>
          </select>
        </div>
        <div class="form-row"><label for="location">Venue / address</label><input id="location" name="location" type="text" maxlength="200"></div>
      </div>
      <div class="form-row"><label for="description">Description</label><textarea id="description" name="description" rows="5" maxlength="4000"></textarea></div>
      <div class="form-grid">
        <div class="form-row"><label for="organizer">Hosted by</label><input id="organizer" name="organizer" type="text" maxlength="120"></div>
        <div class="form-row"><label for="contact">Contact for questions</label><input id="contact" name="contact" type="text" maxlength="200"></div>
      </div>
      ${ALTCHA}
      <button type="submit" class="btn">Submit for review</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    function localToEpoch(v) { if (!v) return null; return Math.floor(new Date(v).getTime() / 1000); }
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      body.starts_at = localToEpoch(body.starts_at);
      body.ends_at = localToEpoch(body.ends_at);
      try {
        await LL.api('/api/events', { method: 'POST', body });
        LL.notice('#notice', 'Thank you. An editor will review and post the event.', 'success');
        f.reset();
      } catch (err) {
        LL.notice('#notice', err.message, 'error');
      }
    });
  </script>`,
});

// ----- Submit book -----
pages['submit-book.html'] = shell({
  altcha: true,
  title: 'Suggest a book - Local Lee',
  description: 'Suggest a book for the Local Lee reading list. Books that fit the spirit of the project may be added.',
  canonical: '/submit/book',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Suggest a book</h1>
      <p>Books on neighborhood, household, place, or work fit best. An editor reads each suggestion.</p>
    </div>

    <form id="form" class="card" novalidate>
      <div class="form-row"><label for="title">Title *</label><input id="title" name="title" type="text" required maxlength="200"></div>
      <div class="form-grid">
        <div class="form-row"><label for="author">Author</label><input id="author" name="author" type="text" maxlength="120"></div>
        <div class="form-row"><label for="year">Year published</label><input id="year" name="year" type="text" maxlength="20"></div>
      </div>
      <div class="form-row"><label for="description">What is the book?</label><textarea id="description" name="description" rows="4" maxlength="4000"></textarea></div>
      <div class="form-row"><label for="why_we_read">Why should we read it together?</label><textarea id="why_we_read" name="why_we_read" rows="4" maxlength="2000"></textarea></div>
      ${ALTCHA}
      <button type="submit" class="btn">Submit for review</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        await LL.api('/api/books', { method: 'POST', body });
        LL.notice('#notice', 'Thank you. An editor will read your suggestion.', 'success');
        f.reset();
      } catch (err) { LL.notice('#notice', err.message, 'error'); }
    });
  </script>`,
});

// ----- Submit aid resource -----
pages['submit-aid-resource.html'] = shell({
  altcha: true,
  title: 'Suggest a mutual-aid resource - Local Lee',
  description: 'Suggest a food pantry, warming center, family resource, or other ongoing program for the Lee County mutual-aid directory.',
  canonical: '/submit/aid-resource',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Suggest a mutual-aid resource</h1>
      <p>For ongoing programs (pantries, warming centers, family resources). For a one-off need or offer, <a href="/submit/aid-post">post on the board instead</a>.</p>
    </div>
    <form id="form" class="card" novalidate>
      <div class="form-row"><label for="name">Name *</label><input id="name" name="name" type="text" required maxlength="160"></div>
      <div class="form-grid">
        <div class="form-row">
          <label for="category">Category *</label>
          <select id="category" name="category" required>
            <option value="">- pick one -</option>
            <option>Food</option><option>Shelter</option><option>Family</option>
            <option>Health</option><option>Goods</option><option>Transportation</option>
            <option>Financial</option><option>Other</option>
          </select>
        </div>
        <div class="form-row">
          <label for="town">Town</label>
          <select id="town" name="town">
            <option value="">- pick one -</option>
            <option>Dixon</option><option>Amboy</option><option>Ashton</option>
            <option>Compton</option><option>Franklin Grove</option><option>Lee Center</option>
            <option>Paw Paw</option><option>Sublette</option><option>West Brooklyn</option>
            <option>Harmon</option><option>Nelson</option><option>Steward</option>
          </select>
        </div>
      </div>
      <div class="form-row"><label for="description">Description</label><textarea id="description" name="description" rows="4" maxlength="4000"></textarea></div>
      <div class="form-grid">
        <div class="form-row"><label for="address">Address</label><input id="address" name="address" type="text" maxlength="200"></div>
        <div class="form-row"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" maxlength="40"></div>
        <div class="form-row"><label for="website">Website</label><input id="website" name="website" type="url" maxlength="300"></div>
        <div class="form-row"><label for="hours">Hours</label><input id="hours" name="hours" type="text" maxlength="300"></div>
      </div>
      <div class="form-row"><label for="notes">Notes for the editor</label><textarea id="notes" name="notes" rows="3" maxlength="2000"></textarea></div>
      ${ALTCHA}
      <button type="submit" class="btn">Submit for review</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        await LL.api('/api/aid/resources', { method: 'POST', body });
        LL.notice('#notice', 'Thank you. An editor will review and post.', 'success');
        f.reset();
      } catch (err) { LL.notice('#notice', err.message, 'error'); }
    });
  </script>`,
});

// ----- Submit aid post (need or offer) -----
pages['submit-aid-post.html'] = shell({
  altcha: true,
  title: 'Post a need or offer - Local Lee',
  description: 'Post a need or offer to the Local Lee mutual-aid board. Posts are reviewed before they appear and refresh every 30 days.',
  canonical: '/submit/aid-post',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Post a need or offer</h1>
      <p>Tell neighbors what you need or what you can give. An editor reads each post before it goes up. Posts come down automatically after 30 days; you can re-post.</p>
    </div>

    <form id="form" class="card" novalidate>
      <fieldset class="form-row" style="border:0;padding:0;margin:0 0 1em">
        <legend><strong>I want to post a…</strong></legend>
        <label style="display:inline-flex;gap:.4em;font-weight:400;margin-right:1.5em"><input type="radio" name="kind" value="need" required> Need (asking for help)</label>
        <label style="display:inline-flex;gap:.4em;font-weight:400"><input type="radio" name="kind" value="offer"> Offer (giving help)</label>
      </fieldset>

      <div class="form-row"><label for="title">Short title *</label><input id="title" name="title" type="text" required maxlength="160"></div>
      <div class="form-row"><label for="body">Details *</label><textarea id="body" name="body" rows="5" required maxlength="4000"></textarea></div>
      <div class="form-grid">
        <div class="form-row">
          <label for="category">Category</label>
          <select id="category" name="category">
            <option value="">- pick one -</option>
            <option>Food</option><option>Shelter</option><option>Family</option>
            <option>Health</option><option>Goods</option><option>Tools</option>
            <option>Transportation</option><option>Skills/Time</option><option>Financial</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-row">
          <label for="town">Town</label>
          <select id="town" name="town">
            <option value="">- pick one -</option>
            <option>Dixon</option><option>Amboy</option><option>Ashton</option>
            <option>Compton</option><option>Franklin Grove</option><option>Lee Center</option>
            <option>Paw Paw</option><option>Sublette</option><option>West Brooklyn</option>
            <option>Harmon</option><option>Nelson</option><option>Steward</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-row"><label for="contact_name">Your name (or what to call you)</label><input id="contact_name" name="contact_name" type="text" maxlength="80"></div>
        <div class="form-row"><label for="contact">How to reach you *</label><input id="contact" name="contact" type="text" required maxlength="200" placeholder="phone, email, or what works"></div>
      </div>
      ${ALTCHA}
      <button type="submit" class="btn">Submit for review</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    const params = new URLSearchParams(location.search);
    const k = params.get('kind');
    if (k === 'need' || k === 'offer') {
      const radio = document.querySelector('input[name="kind"][value="' + k + '"]');
      if (radio) radio.checked = true;
    }
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) {
        if (!el.name) continue;
        if (el.type === 'radio' && !el.checked) continue;
        body[el.name] = el.value;
      }
      try {
        await LL.api('/api/aid/posts', { method: 'POST', body });
        LL.notice('#notice', 'Thank you. An editor will review and post.', 'success');
        f.reset();
      } catch (err) { LL.notice('#notice', err.message, 'error'); }
    });
  </script>`,
});

// ----- Admin -----
pages['admin.html'] = shell({
  title: 'Admin - Local Lee',
  description: 'Local Lee admin dashboard.',
  canonical: '/admin',
  extraHead: '<meta name="robots" content="noindex"><link rel="stylesheet" href="/css/quill.snow.css"><script src="/js/quill.min.js" defer></script>',
  main: `    <div class="page-head">
      <h1>Admin</h1>
      <p>Review pending submissions, manage what\\'s already on the site, and update the brand mark.</p>
    </div>
    <div id="auth-gate" hidden>
      <div class="notice error">You need to sign in as an administrator. <a href="/login?next=/admin">Sign in</a></div>
    </div>
    <div id="dash" hidden>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" aria-selected="true" data-which="queue">Pending queue</button>
        <button class="tab" role="tab" aria-selected="false" data-which="manage">Manage</button>
        <button class="tab" role="tab" aria-selected="false" data-which="newsletter">Newsletter</button>
        <button class="tab" role="tab" aria-selected="false" data-which="discussion">Discussion</button>
        <button class="tab" role="tab" aria-selected="false" data-which="donation">Donations</button>
        <button class="tab" role="tab" aria-selected="false" data-which="logo">Logo</button>
      </div>

      <div id="panel-queue" class="panel">
        <section><h2>Businesses</h2><div id="q-businesses"></div></section>
        <section><h2>Business claim requests</h2><div id="q-claims"></div></section>
        <section><h2>Events</h2><div id="q-events"></div></section>
        <section><h2>Books</h2><div id="q-books"></div></section>
        <section><h2>Mutual aid: resources</h2><div id="q-aid-resources"></div></section>
        <section><h2>Mutual aid: needs &amp; offers</h2><div id="q-aid-posts"></div></section>
      </div>

      <div id="panel-manage" class="panel" hidden>
        <p class="dim small">Everything on the site, regardless of status. Use the delete button to remove a record permanently.</p>
        <section><h2>Businesses</h2><div id="m-businesses"></div></section>
        <section><h2>Events</h2><div id="m-events"></div></section>
        <section><h2>Books</h2><div id="m-books"></div></section>
        <section><h2>Book comments</h2><div id="m-comments"></div></section>
        <section><h2>Mutual aid: resources</h2><div id="m-aid-resources"></div></section>
        <section><h2>Mutual aid: needs &amp; offers</h2><div id="m-aid-posts"></div></section>
      </div>

      <div id="panel-newsletter" class="panel" hidden>
        <h2>Author a newsletter post</h2>
        <form id="nl-form" class="card" novalidate>
          <input type="hidden" id="nl-id" value="">
          <div class="form-row"><label for="nl-title">Title</label><input id="nl-title" type="text" maxlength="200" required></div>
          <div class="form-row">
            <label for="nl-editor">Body</label>
            <div id="nl-editor" style="min-height:320px;background:#fff"></div>
            <p class="hint">Use the toolbar to format - headings, lists, links, images. The HTML is sanitized server-side before saving.</p>
          </div>
          <button type="submit" class="btn">Save draft</button>
          <button type="button" class="btn btn-field" id="nl-publish">Save &amp; publish</button>
          <button type="button" class="btn btn-secondary" id="nl-clear">New post</button>
          <div id="nl-msg" class="notice small" hidden></div>
        </form>

        <h3>Existing posts</h3>
        <div id="nl-list"></div>

        <h3>Topic suggestions from neighbors</h3>
        <div id="nl-topics"></div>
      </div>

      <div id="panel-discussion" class="panel" hidden>
        <h2>Threads</h2>
        <p class="dim small">Lock a thread to stop new replies; delete to remove the whole thread (and its replies).</p>
        <div id="d-threads"></div>
      </div>

      <div id="panel-donation" class="panel" hidden>
        <h2>Donation page settings</h2>
        <p class="dim small">Numbers entered as whole dollars are converted to cents.</p>
        <form id="don-form" class="card" novalidate>
          <div class="form-grid">
            <div class="form-row"><label for="don-goal">Goal (whole dollars)</label><input id="don-goal" type="number" min="0" step="1"></div>
            <div class="form-row"><label for="don-raised">Raised so far (whole dollars)</label><input id="don-raised" type="number" min="0" step="1"></div>
            <div class="form-row"><label for="don-currency">Currency</label><input id="don-currency" type="text" maxlength="8" placeholder="USD"></div>
            <div class="form-row"><label for="don-url-label">Button label</label><input id="don-url-label" type="text" maxlength="60" placeholder="Donate"></div>
          </div>
          <div class="form-row"><label for="don-url">External donate URL <span class="dim small">(GoFundMe, Donorbox, Stripe, etc.)</span></label><input id="don-url" type="url" maxlength="400"></div>
          <div class="form-row"><label for="don-msg">Message shown above the progress bar</label><textarea id="don-msg" rows="6" maxlength="4000"></textarea></div>
          <button type="submit" class="btn">Save</button>
          <div id="don-status" class="notice small" hidden></div>
        </form>
      </div>

      <div id="panel-logo" class="panel" hidden>
        <h2>Brand mark</h2>
        <p>This image appears in the header on every page (and in the footer of social previews). PNG, JPEG, SVG, WebP, or GIF, up to 1 MB. Square images look best.</p>
        <div class="card" style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:center">
          <img id="logo-preview" src="/brand-mark" alt="Current brand mark" style="width:96px;height:96px;border:1px solid var(--rule);background:var(--cream);border-radius:6px;padding:6px">
          <form id="logo-form" style="flex:1 1 240px">
            <div class="form-row">
              <label for="logo-file">Choose a new image</label>
              <input id="logo-file" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif">
            </div>
            <button type="submit" class="btn">Upload</button>
            <button type="button" class="btn btn-secondary" id="logo-reset">Reset to default</button>
            <div id="logo-msg" class="notice small" hidden></div>
          </form>
        </div>
      </div>
    </div>`,
  extraScript: `<script>
    function showPanel(which) {
      document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.which === which ? 'true' : 'false'));
      document.querySelectorAll('.panel').forEach(p => p.hidden = true);
      document.getElementById('panel-' + which).hidden = false;
    }
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showPanel(t.dataset.which)));

    function row(label, body, actions) {
      return \`<article class="card" style="margin-bottom:1em">
        <div class="meta">\${label}</div>
        \${body}
        <div style="margin-top:.6em;display:flex;gap:.4em;flex-wrap:wrap">\${actions}</div>
      </article>\`;
    }

    function statusTag(s) {
      if (s === 'approved') return '<span class="tag" style="background:#d9e1c2;border-color:#a8b88a">Approved</span>';
      if (s === 'pending') return '<span class="tag" style="background:#fff3cf;border-color:#c89c4d">Pending</span>';
      if (s === 'rejected') return '<span class="tag" style="background:#f1d9c9;border-color:#d6a896">Rejected</span>';
      if (s === 'expired') return '<span class="tag">Expired</span>';
      return '<span class="tag">' + LL.escape(s || '') + '</span>';
    }

    async function action(type, id, decision, claim) {
      const url = claim
        ? '/api/admin/business/' + id + '/claim/' + decision
        : '/api/admin/' + type + '/' + id + '/' + decision;
      try {
        await LL.api(url, { method: 'POST' });
        await load();
      } catch (err) { alert(err.message); }
    }
    window.action = action;

    async function del(type, id, label) {
      if (!confirm('Delete \"' + label + '\"? This cannot be undone.')) return;
      try {
        await LL.api('/api/admin/' + type + '/' + id + '/delete', { method: 'POST' });
        await load();
      } catch (err) { alert(err.message); }
    }
    window.del = del;

    function delBtn(type, id, label) {
      const safe = String(label).replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
      return '<button class="btn btn-barn" onclick="del(\\'' + type + '\\',' + id + ',\\'' + safe + '\\')">Delete</button>';
    }

    async function load() {
      const me = (await LL.api('/api/me')).user;
      if (!me || me.role !== 'admin') {
        document.getElementById('auth-gate').hidden = false;
        return;
      }
      document.getElementById('dash').hidden = false;

      // ---- queue ----
      const q = await LL.api('/api/admin/queue');
      const businesses = q.businesses.filter(b => b.status === 'pending');
      const claims = q.businesses.filter(b => b.status === 'approved' && b.claim_status === 'claim_pending');

      document.getElementById('q-businesses').innerHTML = businesses.length
        ? businesses.map(b => row(
            (b.category_name || '-') + (b.town ? ' · ' + b.town : ''),
            '<h3 style="margin:0">' + LL.escape(b.name) + '</h3>' + (b.description ? '<p>' + LL.escape(b.description) + '</p>' : '') +
              '<p class="small">' + [b.address, b.phone, b.email, b.website].filter(Boolean).map(LL.escape).join(' · ') + '</p>',
            '<button class="btn btn-field" onclick="action(\\'business\\',' + b.id + ',\\'approve\\')">Approve</button>' +
            '<button class="btn btn-barn" onclick="action(\\'business\\',' + b.id + ',\\'reject\\')">Reject</button>'
          )).join('')
        : '<p class="dim">Nothing pending.</p>';

      document.getElementById('q-claims').innerHTML = claims.length
        ? claims.map(b => row(
            'Claim request',
            '<h3 style="margin:0">' + LL.escape(b.name) + '</h3><p class="small">User #' + b.owner_user_id + ' is claiming this listing.</p>',
            '<button class="btn btn-field" onclick="action(\\'business\\',' + b.id + ',\\'approve\\',true)">Verify owner</button>' +
            '<button class="btn btn-barn" onclick="action(\\'business\\',' + b.id + ',\\'reject\\',true)">Deny claim</button>'
          )).join('')
        : '<p class="dim">No claim requests.</p>';

      document.getElementById('q-events').innerHTML = q.events.length
        ? q.events.map(e => row(
            LL.formatDate(e.starts_at) + (e.town ? ' · ' + e.town : ''),
            '<h3 style="margin:0">' + LL.escape(e.title) + '</h3>' + (e.description ? '<p>' + LL.escape(e.description) + '</p>' : ''),
            '<button class="btn btn-field" onclick="action(\\'event\\',' + e.id + ',\\'approve\\')">Approve</button>' +
            '<button class="btn btn-barn" onclick="action(\\'event\\',' + e.id + ',\\'reject\\')">Reject</button>'
          )).join('')
        : '<p class="dim">Nothing pending.</p>';

      document.getElementById('q-books').innerHTML = q.books.length
        ? q.books.map(b => row(
            (b.author || 'Unknown') + (b.year ? ' · ' + b.year : ''),
            '<h3 style="margin:0">' + LL.escape(b.title) + '</h3>' + (b.description ? '<p>' + LL.escape(b.description) + '</p>' : '') + (b.why_we_read ? '<blockquote>' + LL.escape(b.why_we_read) + '</blockquote>' : ''),
            '<button class="btn btn-field" onclick="action(\\'book\\',' + b.id + ',\\'approve\\')">Approve</button>' +
            '<button class="btn btn-barn" onclick="action(\\'book\\',' + b.id + ',\\'reject\\')">Reject</button>'
          )).join('')
        : '<p class="dim">Nothing pending.</p>';

      document.getElementById('q-aid-resources').innerHTML = q.aidResources.length
        ? q.aidResources.map(r => row(
            r.category + (r.town ? ' · ' + r.town : ''),
            '<h3 style="margin:0">' + LL.escape(r.name) + '</h3>' + (r.description ? '<p>' + LL.escape(r.description) + '</p>' : ''),
            '<button class="btn btn-field" onclick="action(\\'aidResource\\',' + r.id + ',\\'approve\\')">Approve</button>' +
            '<button class="btn btn-barn" onclick="action(\\'aidResource\\',' + r.id + ',\\'reject\\')">Reject</button>'
          )).join('')
        : '<p class="dim">Nothing pending.</p>';

      document.getElementById('q-aid-posts').innerHTML = q.aidPosts.length
        ? q.aidPosts.map(p => row(
            (p.kind === 'need' ? 'Need' : 'Offer') + (p.category ? ' · ' + p.category : '') + (p.town ? ' · ' + p.town : ''),
            '<h3 style="margin:0">' + LL.escape(p.title) + '</h3><p>' + LL.escape(p.body) + '</p>' +
              '<p class="small"><strong>Contact:</strong> ' + LL.escape(p.contact || '') + (p.contact_name ? ' (' + LL.escape(p.contact_name) + ')' : '') + '</p>',
            '<button class="btn btn-field" onclick="action(\\'aidPost\\',' + p.id + ',\\'approve\\')">Approve</button>' +
            '<button class="btn btn-barn" onclick="action(\\'aidPost\\',' + p.id + ',\\'reject\\')">Reject</button>'
          )).join('')
        : '<p class="dim">Nothing pending.</p>';

      // ---- manage (everything) ----
      const all = await LL.api('/api/admin/all');
      document.getElementById('m-businesses').innerHTML = all.businesses.length
        ? all.businesses.map(b => row(
            statusTag(b.status) + ' ' + (b.category_name ? LL.escape(b.category_name) : '') + (b.town ? ' · ' + LL.escape(b.town) : ''),
            '<h3 style="margin:0"><a href="/directory/' + LL.escape(b.slug) + '">' + LL.escape(b.name) + '</a></h3>',
            delBtn('business', b.id, b.name)
          )).join('')
        : '<p class="dim">No businesses.</p>';

      document.getElementById('m-events').innerHTML = all.events.length
        ? all.events.map(e => row(
            statusTag(e.status) + ' ' + LL.escape(LL.formatDate(e.starts_at)) + (e.town ? ' · ' + LL.escape(e.town) : ''),
            '<h3 style="margin:0"><a href="/events/' + LL.escape(e.slug) + '">' + LL.escape(e.title) + '</a></h3>',
            delBtn('event', e.id, e.title)
          )).join('')
        : '<p class="dim">No events.</p>';

      document.getElementById('m-books').innerHTML = all.books.length
        ? all.books.map(b => row(
            statusTag(b.status) + (b.curated ? ' · <span class="tag">Curated</span>' : '') + (b.author ? ' · ' + LL.escape(b.author) : '') + (b.year ? ' · ' + LL.escape(b.year) : ''),
            '<h3 style="margin:0"><a href="/literature/' + LL.escape(b.slug) + '">' + LL.escape(b.title) + '</a></h3>',
            delBtn('book', b.id, b.title)
          )).join('')
        : '<p class="dim">No books.</p>';

      document.getElementById('m-comments').innerHTML = all.bookComments.length
        ? all.bookComments.map(c => row(
            'On <a href="/literature/' + LL.escape(c.book_slug) + '">' + LL.escape(c.book_title) + '</a> by ' + LL.escape(c.display_name || c.email.split('@')[0]) + ' · ' + LL.escape(LL.formatDate(c.created_at)),
            '<p>' + LL.escape(c.body) + '</p>',
            delBtn('book-comment', c.id, c.body.slice(0, 40))
          )).join('')
        : '<p class="dim">No comments yet.</p>';

      document.getElementById('m-aid-resources').innerHTML = all.aidResources.length
        ? all.aidResources.map(r => row(
            statusTag(r.status) + ' · ' + LL.escape(r.category) + (r.town ? ' · ' + LL.escape(r.town) : ''),
            '<h3 style="margin:0">' + LL.escape(r.name) + '</h3>',
            delBtn('aidResource', r.id, r.name)
          )).join('')
        : '<p class="dim">No resources.</p>';

      document.getElementById('m-aid-posts').innerHTML = all.aidPosts.length
        ? all.aidPosts.map(p => row(
            statusTag(p.status) + ' · ' + (p.kind === 'need' ? 'Need' : 'Offer') + (p.category ? ' · ' + LL.escape(p.category) : '') + (p.town ? ' · ' + LL.escape(p.town) : ''),
            '<h3 style="margin:0">' + LL.escape(p.title) + '</h3>',
            delBtn('aidPost', p.id, p.title)
          )).join('')
        : '<p class="dim">No posts.</p>';

      await loadNewsletter();
      await loadDiscussion();
      await loadDonation();
    }

    // ---- newsletter ----
    async function loadNewsletter() {
      const data = await LL.api('/api/admin/newsletter');
      const list = document.getElementById('nl-list');
      list.innerHTML = data.posts.length
        ? data.posts.map(p => row(
            (p.status === 'published' ? '<span class="tag" style="background:#d9e1c2;border-color:#a8b88a">Published</span>' : '<span class="tag">Draft</span>') + ' · ' + LL.escape(LL.formatDate(p.created_at)),
            '<h3 style="margin:0">' + LL.escape(p.title) + '</h3><p>' + LL.escape((p.body || '').slice(0, 200)) + ((p.body || '').length > 200 ? '...' : '') + '</p>',
            '<button class="btn btn-secondary" onclick="nlEdit(' + p.id + ')">Edit</button>' +
            (p.status === 'published'
              ? '<a class="btn btn-secondary" target="_blank" href="/newsletter/' + LL.escape(p.slug) + '">View</a>' +
                '<button class="btn btn-secondary" onclick="nlPublish(' + p.id + ',false)">Unpublish</button>'
              : '<button class="btn btn-field" onclick="nlPublish(' + p.id + ',true)">Publish</button>') +
            '<button class="btn btn-barn" onclick="nlDelete(' + p.id + ',\\'' + (p.title || '').replace(/[\\\\\\'"]/g,'') + '\\')">Delete</button>'
          )).join('')
        : '<p class="dim">No posts yet.</p>';
      const tlist = document.getElementById('nl-topics');
      tlist.innerHTML = data.topics.length
        ? data.topics.map(t => row(
            LL.escape(LL.formatDate(t.created_at)) + (t.contact_name ? ' · from ' + LL.escape(t.contact_name) : '') + (t.contact ? ' · ' + LL.escape(t.contact) : ''),
            '<p>' + LL.escape(t.body) + '</p>',
            '<button class="btn btn-barn" onclick="topicDelete(' + t.id + ')">Dismiss</button>'
          )).join('')
        : '<p class="dim">No topic suggestions waiting.</p>';
    }
    // Quill editor for newsletter body. Initialised lazily because the
    // Quill script is loaded with defer.
    let nlQuill = null;
    function initQuillIfReady() {
      if (nlQuill || typeof Quill === 'undefined') return;
      nlQuill = new Quill('#nl-editor', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean'],
          ],
        },
      });
    }
    window.addEventListener('load', initQuillIfReady);

    window.nlEdit = async function (id) {
      initQuillIfReady();
      const data = await LL.api('/api/admin/newsletter');
      const p = data.posts.find(x => x.id === id);
      if (!p) return;
      document.getElementById('nl-id').value = p.id;
      document.getElementById('nl-title').value = p.title;
      if (nlQuill) nlQuill.root.innerHTML = p.body || '';
      document.getElementById('panel-newsletter').scrollIntoView({ behavior: 'smooth' });
    };
    window.nlPublish = async function (id, publish) {
      try {
        await LL.api('/api/admin/newsletter/' + id, { method: 'POST', body: { publish } });
        await loadNewsletter();
      } catch (err) { alert(err.message); }
    };
    window.nlDelete = async function (id, label) {
      if (!confirm('Delete "' + label + '"?')) return;
      try { await LL.api('/api/admin/newsletter/' + id + '/delete', { method: 'POST' }); await loadNewsletter(); }
      catch (err) { alert(err.message); }
    };
    window.topicDelete = async function (id) {
      try { await LL.api('/api/admin/topic/' + id + '/delete', { method: 'POST' }); await loadNewsletter(); }
      catch (err) { alert(err.message); }
    };
    document.getElementById('nl-clear').addEventListener('click', () => {
      document.getElementById('nl-id').value = '';
      document.getElementById('nl-title').value = '';
      if (nlQuill) nlQuill.root.innerHTML = '';
    });
    async function nlSave(publish) {
      initQuillIfReady();
      const id = document.getElementById('nl-id').value;
      const html = nlQuill ? nlQuill.root.innerHTML : '';
      const body = {
        title: document.getElementById('nl-title').value,
        body: html,
      };
      if (typeof publish === 'boolean') body.publish = publish;
      try {
        if (id) await LL.api('/api/admin/newsletter/' + id, { method: 'POST', body });
        else await LL.api('/api/admin/newsletter', { method: 'POST', body });
        LL.notice('#nl-msg', publish ? 'Published.' : 'Saved.', 'success');
        document.getElementById('nl-id').value = '';
        document.getElementById('nl-title').value = '';
        if (nlQuill) nlQuill.root.innerHTML = '';
        await loadNewsletter();
      } catch (err) { LL.notice('#nl-msg', err.message, 'error'); }
    }
    document.getElementById('nl-form').addEventListener('submit', (e) => {
      e.preventDefault();
      nlSave(false);
    });
    document.getElementById('nl-publish').addEventListener('click', () => nlSave(true));

    // ---- discussion mod ----
    async function loadDiscussion() {
      const { threads } = await LL.api('/api/threads');
      document.getElementById('d-threads').innerHTML = threads.length
        ? threads.map(t => row(
            (t.locked ? '<span class="tag">Locked</span> ' : '') + 'started ' + LL.escape(LL.formatDate(t.created_at)) + ' &middot; ' + t.reply_count + ' replies',
            '<h3 style="margin:0"><a target="_blank" href="/discussion/' + LL.escape(t.slug) + '">' + LL.escape(t.title) + '</a></h3><p class="small">by ' + LL.userLabel(t) + '</p>',
            '<button class="btn btn-secondary" onclick="thLock(' + t.id + ',' + (t.locked ? 0 : 1) + ')">' + (t.locked ? 'Unlock' : 'Lock') + '</button>' +
            '<button class="btn btn-barn" onclick="thDel(' + t.id + ',\\'' + (t.title || '').replace(/[\\\\\\'"]/g,'') + '\\')">Delete</button>'
          )).join('')
        : '<p class="dim">No threads yet.</p>';
    }
    window.thLock = async function (id, locked) {
      try { await LL.api('/api/admin/thread/' + id + '/lock', { method: 'POST', body: { locked: !!locked } }); await loadDiscussion(); }
      catch (err) { alert(err.message); }
    };
    window.thDel = async function (id, label) {
      if (!confirm('Delete the thread "' + label + '"?')) return;
      try { await LL.api('/api/admin/thread/' + id + '/delete', { method: 'POST' }); await loadDiscussion(); }
      catch (err) { alert(err.message); }
    };

    // ---- donation ----
    async function loadDonation() {
      const { donation: d } = await LL.api('/api/donation');
      document.getElementById('don-goal').value = Math.round((d.goal_cents || 0) / 100);
      document.getElementById('don-raised').value = Math.round((d.raised_cents || 0) / 100);
      document.getElementById('don-currency').value = d.currency || 'USD';
      document.getElementById('don-url').value = d.url || '';
      document.getElementById('don-url-label').value = d.url_label || 'Donate';
      document.getElementById('don-msg').value = d.message || '';
    }
    document.getElementById('don-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        goal_cents: (parseInt(document.getElementById('don-goal').value, 10) || 0) * 100,
        raised_cents: (parseInt(document.getElementById('don-raised').value, 10) || 0) * 100,
        currency: document.getElementById('don-currency').value,
        url: document.getElementById('don-url').value,
        url_label: document.getElementById('don-url-label').value,
        message: document.getElementById('don-msg').value,
      };
      try {
        await LL.api('/api/admin/donation', { method: 'POST', body });
        LL.notice('#don-status', 'Saved.', 'success');
      } catch (err) { LL.notice('#don-status', err.message, 'error'); }
    });

    // ---- logo upload ----
    document.getElementById('logo-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('logo-file').files[0];
      if (!file) { LL.notice('#logo-msg', 'Pick a file first.', 'error'); return; }
      if (file.size > 1024 * 1024) { LL.notice('#logo-msg', 'File is over 1 MB.', 'error'); return; }
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      try {
        await LL.api('/api/admin/logo', { method: 'POST', body: { data: dataUrl } });
        document.getElementById('logo-preview').src = '/brand-mark?v=' + Date.now();
        document.querySelectorAll('img.brand-mark').forEach(i => i.src = '/brand-mark?v=' + Date.now());
        LL.notice('#logo-msg', 'Logo updated. The new brand mark will be live for visitors within a few minutes.', 'success');
        document.getElementById('logo-file').value = '';
      } catch (err) {
        LL.notice('#logo-msg', err.message, 'error');
      }
    });
    document.getElementById('logo-reset').addEventListener('click', async () => {
      if (!confirm('Reset to the default brand mark?')) return;
      try {
        await LL.api('/api/admin/logo/reset', { method: 'POST' });
        document.getElementById('logo-preview').src = '/brand-mark?v=' + Date.now();
        document.querySelectorAll('img.brand-mark').forEach(i => i.src = '/brand-mark?v=' + Date.now());
        LL.notice('#logo-msg', 'Reset to default.', 'success');
      } catch (err) {
        LL.notice('#logo-msg', err.message, 'error');
      }
    });

    load();
  </script>`,
});

// ----- Newsletter list -----
pages['newsletter.html'] = shell({
  title: 'Newsletter - Local Lee',
  description: 'The Local Lee newsletter: short, occasional reports from Lee County, Illinois on what is going on, who is doing it, and what we have been thinking about.',
  canonical: '/newsletter',
  main: `    <div class="page-head">
      <h1>The Local Lee newsletter</h1>
      <p>Short, occasional reports from around the county. Have a topic in mind? <a href="/newsletter/suggest">Suggest one.</a></p>
    </div>
    <ul class="row-list" id="posts" aria-busy="true"><li class="dim">Loading...</li></ul>`,
  extraScript: `<script>
    (async () => {
      const list = document.getElementById('posts');
      try {
        const { posts } = await LL.api('/api/newsletter');
        if (!posts.length) {
          list.innerHTML = '<li class="dim">Nothing posted yet. Check back soon.</li>';
        } else {
          list.innerHTML = posts.map(p => \`
            <li>
              <h3 style="margin:0"><a href="/newsletter/\${LL.escape(p.slug)}">\${LL.escape(p.title)}</a></h3>
              <div class="meta">\${LL.escape(LL.formatDay(p.published_at || p.created_at))}\${p.author_name ? ' &middot; by ' + LL.escape(p.author_name) : ''}</div>
              <p>\${LL.escape((p.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 240))}\${(p.excerpt || '').length >= 280 ? '...' : ''}</p>
            </li>\`).join('');
        }
      } catch (err) { list.innerHTML = '<li class="dim">Could not load posts.</li>'; }
      list.setAttribute('aria-busy', 'false');
    })();
  </script>`,
});

// ----- Single newsletter post -----
pages['newsletter-post.html'] = shell({
  altcha: true,
  title: 'Newsletter post - Local Lee',
  description: 'A post from the Local Lee newsletter.',
  canonical: '/newsletter',
  main: `    <article id="post" aria-busy="true"><p class="dim">Loading...</p></article>
    <section id="comments-section" hidden>
      <h2>Comments</h2>
      <ul class="row-list" id="comments"></ul>
      <form id="comment-form" class="card" hidden>
        <div class="form-row">
          <label for="c-body">Add to the conversation</label>
          <textarea id="c-body" name="body" rows="4" maxlength="4000" required></textarea>
        </div>
        ${ALTCHA}
        <button type="submit" class="btn">Post comment</button>
        <div id="c-notice" class="notice small" hidden></div>
      </form>
      <p id="comment-signin" class="dim" hidden><a href="/login">Sign in</a> or <a href="/register">join</a> to comment.</p>
    </section>`,
  extraScript: `<script>
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('post');
    let post = null;

    function renderComments(comments) {
      const ul = document.getElementById('comments');
      if (!comments.length) {
        ul.innerHTML = '<li class="dim">No comments yet.</li>';
        return;
      }
      ul.innerHTML = comments.map(c => \`
        <li class="comment-row">
          \${LL.avatar(c, 40)}
          <div>
            <div class="meta"><strong>\${LL.userLabel(c)}</strong> &middot; \${LL.escape(LL.formatDate(c.created_at))}</div>
            <p>\${LL.escape(c.body)}</p>
          </div>
        </li>\`).join('');
    }

    async function loadAll() {
      try {
        const data = await LL.api('/api/newsletter/' + encodeURIComponent(slug));
        post = data.post;
        document.title = post.title + ' - Local Lee';
        const ld = {
          '@context': 'https://schema.org', '@type': 'BlogPosting',
          headline: post.title, datePublished: new Date((post.published_at || post.created_at) * 1000).toISOString(),
          author: post.author_name ? { '@type': 'Person', name: post.author_name } : undefined
        };
        const ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.textContent = JSON.stringify(ld);
        document.head.appendChild(ldEl);
        // post.body is server-sanitized HTML; render it directly. Old
        // plain-text posts (from before the rich-text editor) still
        // render fine - line breaks are preserved by the wrapper below.
        const looksLikeHtml = /<[a-z][\\s\\S]*>/i.test(post.body || '');
        const bodyHtml = looksLikeHtml
          ? post.body
          : '<p>' + LL.escape(post.body || '').replace(/\\n{2,}/g, '</p><p>').replace(/\\n/g, '<br>') + '</p>';
        root.innerHTML = \`
          <div class="page-head">
            <p class="small dim"><a href="/newsletter">&larr; All posts</a></p>
            <h1>\${LL.escape(post.title)}</h1>
            <p class="meta">\${LL.escape(LL.formatDay(post.published_at || post.created_at))}\${post.author_name ? ' &middot; by ' + LL.escape(post.author_name) : ''}</p>
          </div>
          <article class="prose newsletter-body">\${bodyHtml}</article>
        \`;
        renderComments(data.comments);
        document.getElementById('comments-section').hidden = false;
        const me = (await LL.api('/api/me')).user;
        if (me) document.getElementById('comment-form').hidden = false;
        else document.getElementById('comment-signin').hidden = false;
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">Post not found. <a href="/newsletter">Back to the newsletter.</a></p>';
      }
    }

    document.getElementById('comment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      if (!body.body) return;
      try {
        await LL.api('/api/newsletter/' + post.id + '/comments', { method: 'POST', body });
        document.getElementById('c-body').value = '';
        const data = await LL.api('/api/newsletter/' + encodeURIComponent(slug));
        renderComments(data.comments);
        LL.notice('#c-notice', 'Posted.', 'success');
      } catch (err) { LL.notice('#c-notice', err.message, 'error'); }
    });

    loadAll();
  </script>`,
});

// ----- Newsletter topic suggestion -----
pages['newsletter-suggest.html'] = shell({
  altcha: true,
  title: 'Suggest a newsletter topic - Local Lee',
  description: 'Suggest a topic for an upcoming Local Lee newsletter post.',
  canonical: '/newsletter/suggest',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Suggest a topic</h1>
      <p>What would you like to see covered in an upcoming Local Lee post? Stories, businesses, events, questions about how something works in the county - all welcome.</p>
    </div>
    <form id="form" class="card" novalidate>
      <div class="form-row">
        <label for="body">Your suggestion *</label>
        <textarea id="body" name="body" rows="5" required maxlength="2000"></textarea>
      </div>
      <div class="form-grid">
        <div class="form-row"><label for="contact_name">Your name (optional)</label><input id="contact_name" name="contact_name" type="text" maxlength="80"></div>
        <div class="form-row"><label for="contact">Email (optional, if you'd like a reply)</label><input id="contact" name="contact" type="text" maxlength="200"></div>
      </div>
      ${ALTCHA}
      <button type="submit" class="btn">Send</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        await LL.api('/api/newsletter/topics', { method: 'POST', body });
        LL.notice('#notice', 'Thank you - your suggestion is in.', 'success');
        f.reset();
      } catch (err) { LL.notice('#notice', err.message, 'error'); }
    });
  </script>`,
});

// ----- Discussion list -----
pages['discussion.html'] = shell({
  title: 'Community discussion - Local Lee',
  description: 'A space for Lee County neighbors to talk about what is going on in the county.',
  canonical: '/discussion',
  main: `    <div class="page-head">
      <h1>Community discussion</h1>
      <p>Threads from neighbors. Sign in to start one or jump in. <a class="btn btn-secondary" href="/discussion/new" style="margin-left:.5em">Start a thread</a></p>
    </div>
    <ul class="row-list" id="threads" aria-busy="true"><li class="dim">Loading...</li></ul>`,
  extraScript: `<script>
    (async () => {
      const ul = document.getElementById('threads');
      try {
        const { threads } = await LL.api('/api/threads');
        if (!threads.length) {
          ul.innerHTML = '<li class="dim">No threads yet. <a href="/discussion/new">Start the first one.</a></li>';
        } else {
          ul.innerHTML = threads.map(t => \`
            <li class="thread-row">
              \${LL.avatar(t, 40)}
              <div style="flex:1">
                <h3 style="margin:0"><a href="/discussion/\${LL.escape(t.slug)}">\${LL.escape(t.title)}</a>\${t.locked ? ' <span class="tag">Locked</span>' : ''}</h3>
                <div class="meta">started by \${LL.userLabel(t)} &middot; \${LL.escape(LL.formatDate(t.created_at))} &middot; <strong>\${t.reply_count}</strong> repl\${t.reply_count === 1 ? 'y' : 'ies'} &middot; latest \${LL.escape(LL.formatDate(t.last_activity_at))}</div>
              </div>
            </li>\`).join('');
        }
      } catch (err) { ul.innerHTML = '<li class="dim">Could not load threads: ' + LL.escape(err.message || err) + '</li>'; }
      ul.setAttribute('aria-busy', 'false');
    })();
  </script>`,
});

// ----- New thread -----
pages['discussion-new.html'] = shell({
  altcha: true,
  title: 'Start a thread - Local Lee',
  description: 'Start a new community discussion thread on Local Lee.',
  canonical: '/discussion/new',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Start a thread</h1>
      <p>You need to be signed in to start one. Keep it about Lee County and the people who live here.</p>
    </div>
    <div id="signin-gate" class="notice" hidden>
      <a href="/login?next=/discussion/new">Sign in</a> or <a href="/register">join</a> to post.
    </div>
    <form id="form" class="card" novalidate hidden>
      <div class="form-row"><label for="title">Title *</label><input id="title" name="title" type="text" required maxlength="200"></div>
      <div class="form-row"><label for="body">Your post *</label><textarea id="body" name="body" rows="8" required maxlength="8000"></textarea></div>
      ${ALTCHA}
      <button type="submit" class="btn">Post thread</button>
      <div id="notice" class="notice" hidden></div>
    </form>`,
  extraScript: `<script>
    (async () => {
      const me = (await LL.api('/api/me')).user;
      if (!me) { document.getElementById('signin-gate').hidden = false; return; }
      document.getElementById('form').hidden = false;
    })();
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        const r = await LL.api('/api/threads', { method: 'POST', body });
        if (r && r.slug) {
          location.href = '/discussion/' + r.slug;
        } else {
          LL.notice('#notice', 'Posted, but the server did not return a slug. Refresh the discussion page to find your thread.', 'error');
        }
      } catch (err) { LL.notice('#notice', err.message || String(err), 'error'); }
    });
  </script>`,
});

// ----- Single thread -----
pages['thread.html'] = shell({
  altcha: true,
  title: 'Discussion - Local Lee',
  description: 'A community discussion thread on Local Lee.',
  canonical: '/discussion',
  main: `    <article id="thread" aria-busy="true"><p class="dim">Loading...</p></article>
    <section id="replies-section" hidden>
      <h2>Replies</h2>
      <ul class="row-list" id="replies"></ul>
      <form id="reply-form" class="card" hidden>
        <div class="form-row"><label for="r-body">Reply</label><textarea id="r-body" name="body" rows="4" maxlength="8000" required></textarea></div>
        ${ALTCHA}
        <button type="submit" class="btn">Post reply</button>
        <div id="r-notice" class="notice small" hidden></div>
      </form>
      <p id="reply-signin" class="dim" hidden><a href="/login">Sign in</a> to reply.</p>
      <p id="reply-locked" class="dim" hidden>This thread is locked.</p>
    </section>`,
  extraScript: `<script>
    const slug = location.pathname.split('/').filter(Boolean).pop();
    const root = document.getElementById('thread');
    let thread = null;

    function renderReplies(replies) {
      const ul = document.getElementById('replies');
      if (!replies.length) { ul.innerHTML = '<li class="dim">No replies yet.</li>'; return; }
      ul.innerHTML = replies.map(r => \`
        <li class="comment-row">
          \${LL.avatar(r, 40)}
          <div>
            <div class="meta"><strong>\${LL.userLabel(r)}</strong> &middot; \${LL.escape(LL.formatDate(r.created_at))}</div>
            <p>\${LL.escape(r.body)}</p>
          </div>
        </li>\`).join('');
    }

    async function load() {
      try {
        const data = await LL.api('/api/threads/' + encodeURIComponent(slug));
        thread = data.thread;
        document.title = thread.title + ' - Local Lee';
        root.innerHTML = \`
          <div class="page-head">
            <p class="small dim"><a href="/discussion">&larr; All threads</a></p>
            <h1>\${LL.escape(thread.title)}\${thread.locked ? ' <span class="tag">Locked</span>' : ''}</h1>
          </div>
          <div class="comment-row" style="margin-bottom:1em">
            \${LL.avatar(thread, 48)}
            <div>
              <div class="meta">\${LL.userLabel(thread)} &middot; \${LL.escape(LL.formatDate(thread.created_at))}</div>
              <p>\${LL.escape(thread.body)}</p>
            </div>
          </div>
        \`;
        renderReplies(data.replies);
        document.getElementById('replies-section').hidden = false;
        const me = (await LL.api('/api/me')).user;
        if (thread.locked) {
          document.getElementById('reply-locked').hidden = false;
        } else if (me) {
          document.getElementById('reply-form').hidden = false;
        } else {
          document.getElementById('reply-signin').hidden = false;
        }
        root.setAttribute('aria-busy', 'false');
      } catch (err) {
        root.innerHTML = '<p class="dim">Could not load thread: ' + LL.escape(err.message || err) + '. <a href="/discussion">Back to discussion.</a></p>';
      }
    }

    document.getElementById('reply-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = {};
      for (const el of f.elements) if (el.name) body[el.name] = el.value;
      try {
        await LL.api('/api/threads/' + thread.id + '/replies', { method: 'POST', body });
        document.getElementById('r-body').value = '';
        const data = await LL.api('/api/threads/' + encodeURIComponent(slug));
        renderReplies(data.replies);
        LL.notice('#r-notice', 'Posted.', 'success');
      } catch (err) { LL.notice('#r-notice', err.message, 'error'); }
    });

    load();
  </script>`,
});

// ----- Donate -----
pages['donate.html'] = shell({
  title: 'Support Local Lee',
  description: 'Local Lee runs on a tiny budget - hosting, the domain, a bit of advertising in the local paper, the occasional coffee for whoever is moderating. Chip in if you can.',
  canonical: '/donate',
  narrow: true,
  main: `    <div class="page-head">
      <h1>Support Local Lee</h1>
    </div>
    <div id="donation" aria-busy="true"><p class="dim">Loading...</p></div>`,
  extraScript: `<script>
    function dollars(cents, currency) {
      const n = (cents || 0) / 100;
      try {
        return n.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 });
      } catch (_) { return '$' + n.toFixed(0); }
    }
    (async () => {
      const root = document.getElementById('donation');
      try {
        const { donation: d } = await LL.api('/api/donation');
        const goal = Math.max(d.goal_cents || 0, 1);
        const pct = Math.min(100, Math.round((d.raised_cents / goal) * 100));
        const paragraphs = (d.message || '').split(/\\n{2,}/).map(p => '<p>' + LL.escape(p).replace(/\\n/g, '<br>') + '</p>').join('');
        root.innerHTML = \`
          \${paragraphs}
          <div class="card" style="margin:1.5em 0">
            <div class="goal-row"><strong>Raised:</strong> \${LL.escape(dollars(d.raised_cents, d.currency))}</div>
            <div class="goal-row"><strong>Goal:</strong> \${LL.escape(dollars(d.goal_cents, d.currency))}</div>
            <div class="progress" role="progressbar" aria-valuenow="\${pct}" aria-valuemin="0" aria-valuemax="100" style="margin:.7em 0">
              <div class="progress-fill" style="width:\${pct}%"></div>
            </div>
            <div class="meta">\${pct}% of the way there.</div>
            \${d.url ? '<p style="margin-top:1em"><a class="btn btn-barn" href="' + LL.escape(d.url) + '" rel="noopener" target="_blank">' + LL.escape(d.url_label || 'Donate') + '</a></p>' : '<p class="dim small">A donation link will be posted here once we have one set up.</p>'}
          </div>
          <p class="small dim">Funds go toward operating the site - hosting, the domain, occasional advertising in local outlets, and other costs related to running this service. We are not a charity; donations are not tax-deductible. The progress bar is updated by hand, not by an integration, so it may lag the actual total by a day or two.</p>
        \`;
      } catch (err) {
        root.innerHTML = '<p class="dim">Could not load donation info.</p>';
      }
      root.setAttribute('aria-busy', 'false');
    })();
  </script>`,
});

// ----- Profile -----
pages['profile.html'] = shell({
  title: 'Your profile - Local Lee',
  description: 'Your Local Lee profile.',
  canonical: '/profile',
  narrow: true,
  extraHead: '<meta name="robots" content="noindex">',
  main: `    <div class="page-head">
      <h1>Your profile</h1>
      <p>Set the name and image neighbors see when you post on Local Lee.</p>
    </div>
    <div id="signin-gate" hidden><div class="notice error">Sign in to view your profile. <a href="/login?next=/profile">Sign in</a></div></div>
    <div id="profile-body" hidden>
      <div class="card" style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:flex-start">
        <img id="my-avatar" class="avatar" src="" alt="Your avatar" width="96" height="96" style="border:1px solid var(--rule);background:var(--cream);border-radius:50%">
        <form id="avatar-form" style="flex:1 1 220px">
          <div class="form-row">
            <label for="avatar-file">Profile image</label>
            <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp">
            <p class="hint">PNG, JPEG, or WebP. Up to 256 KB. Square images look best.</p>
          </div>
          <button type="submit" class="btn">Upload</button>
          <button type="button" class="btn btn-secondary" id="avatar-reset">Use auto-generated monogram</button>
          <div id="avatar-msg" class="notice small" hidden></div>
        </form>
      </div>
      <form id="profile-form" class="card" style="margin-top:1.5em" novalidate>
        <div class="form-row"><label for="display_name">Display name</label><input id="display_name" name="display_name" type="text" maxlength="80"></div>
        <div class="form-row"><label for="bio">Short bio</label><textarea id="bio" name="bio" rows="3" maxlength="400"></textarea><p class="hint">A line or two about yourself, optional.</p></div>
        <button type="submit" class="btn">Save</button>
        <div id="profile-msg" class="notice small" hidden></div>
      </form>
    </div>`,
  extraScript: `<script>
    let me = null;
    (async () => {
      const r = await LL.api('/api/me');
      if (!r.user) { document.getElementById('signin-gate').hidden = false; return; }
      const p = (await LL.api('/api/me/profile')).user;
      me = p;
      document.getElementById('display_name').value = p.display_name || '';
      document.getElementById('bio').value = p.bio || '';
      document.getElementById('my-avatar').src = '/avatar/' + p.id + '?v=' + Date.now();
      document.getElementById('profile-body').hidden = false;
    })();

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const body = { display_name: f.display_name.value, bio: f.bio.value };
      try {
        await LL.api('/api/me/profile', { method: 'POST', body });
        LL.notice('#profile-msg', 'Saved.', 'success');
      } catch (err) { LL.notice('#profile-msg', err.message, 'error'); }
    });

    document.getElementById('avatar-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('avatar-file').files[0];
      if (!file) { LL.notice('#avatar-msg', 'Pick a file first.', 'error'); return; }
      if (file.size > 256 * 1024) { LL.notice('#avatar-msg', 'File is over 256 KB.', 'error'); return; }
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      try {
        await LL.api('/api/me/avatar', { method: 'POST', body: { data: dataUrl } });
        document.getElementById('my-avatar').src = '/avatar/' + me.id + '?v=' + Date.now();
        LL.notice('#avatar-msg', 'Updated.', 'success');
        document.getElementById('avatar-file').value = '';
      } catch (err) { LL.notice('#avatar-msg', err.message, 'error'); }
    });

    document.getElementById('avatar-reset').addEventListener('click', async () => {
      if (!confirm('Reset your profile image to the auto-generated monogram?')) return;
      try {
        await LL.api('/api/me/avatar/reset', { method: 'POST' });
        document.getElementById('my-avatar').src = '/avatar/' + me.id + '?v=' + Date.now();
        LL.notice('#avatar-msg', 'Reset.', 'success');
      } catch (err) { LL.notice('#avatar-msg', err.message, 'error'); }
    });
  </script>`,
});

// ----- 404 -----
pages['404.html'] = shell({
  title: 'Not found - Local Lee',
  description: 'Page not found.',
  canonical: '/',
  narrow: true,
  main: `    <div class="page-head"><h1>That page is off the map.</h1><p>We couldn't find what you were looking for.</p></div>
    <p><a class="btn" href="/">Back to the front porch</a></p>`,
});

for (const [filename, content] of Object.entries(pages)) {
  fs.writeFileSync(path.join(PUB, filename), content);
  console.log('wrote', filename);
}
console.log('done');
