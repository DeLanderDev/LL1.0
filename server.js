'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const altcha = require('altcha-lib');
const sanitizeHtml = require('sanitize-html');

const NEWSLETTER_HTML = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
    'a', 'blockquote', 'code', 'pre',
    'ul', 'ol', 'li',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    a: (tag, attribs) => {
      const href = attribs.href || '';
      if (/^https?:\/\//i.test(href)) {
        return {
          tagName: 'a',
          attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
        };
      }
      return { tagName: 'a', attribs };
    },
  },
};

const PORT = process.env.PORT || 8082;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'locallee.db');
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@locallee.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SITE_URL = process.env.SITE_URL || 'https://locallee.org';
const POST_TTL_DAYS = 30;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  town TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  hours TEXT,
  owner_user_id INTEGER REFERENCES users(id),
  submitted_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  claim_status TEXT DEFAULT 'unclaimed',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER,
  location TEXT,
  town TEXT,
  organizer TEXT,
  contact TEXT,
  submitted_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_token TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(event_id, user_id),
  UNIQUE(event_id, guest_token)
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  author TEXT,
  year TEXT,
  description TEXT,
  why_we_read TEXT,
  curated INTEGER NOT NULL DEFAULT 0,
  submitted_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS book_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS aid_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  town TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  hours TEXT,
  notes TEXT,
  submitted_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS aid_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('need','offer')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  town TEXT,
  contact TEXT,
  submitted_by INTEGER REFERENCES users(id),
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS newsletters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  author_id INTEGER REFERENCES users(id),
  published_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS newsletter_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  newsletter_id INTEGER NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS topic_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  contact TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  locked INTEGER NOT NULL DEFAULT 0,
  last_activity_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS thread_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS business_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploaded_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  uploaded_by INTEGER REFERENCES users(id),
  row_data TEXT NOT NULL,
  duplicate_of INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution TEXT,
  batch_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_business_imports_status ON business_imports(status);

CREATE INDEX IF NOT EXISTS idx_business_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_aid_resources_status ON aid_resources(status);
CREATE INDEX IF NOT EXISTS idx_aid_posts_status ON aid_posts(status);
CREATE INDEX IF NOT EXISTS idx_aid_posts_expires ON aid_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_newsletters_status ON newsletters(status);
CREATE INDEX IF NOT EXISTS idx_threads_activity ON threads(last_activity_at DESC);
`);

function addColumnIfMissing(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}
addColumnIfMissing('users', 'avatar_ext', 'TEXT');
addColumnIfMissing('users', 'bio', 'TEXT');

function seed() {
  const adminRow = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(ADMIN_EMAIL);
  if (!adminRow) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    db.prepare(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES (?, ?, ?, 'admin')`
    ).run(ADMIN_EMAIL, hash, 'Local Lee Admin');
    console.log(
      `Seeded admin user: ${ADMIN_EMAIL} (default password: ${ADMIN_PASSWORD})`
    );
  }

  const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, parent_id, sort_order) VALUES (?, ?, ?, ?)'
    );
    const taxonomy = [
      ['Farms & Food', 'farms-food', [
        ['Farms & Farmstands', 'farms-farmstands'],
        ['Butchers & Meat Lockers', 'butchers'],
        ['Bakeries', 'bakeries'],
        ['Farmers Markets', 'farmers-markets'],
        ['CSA & Subscription Boxes', 'csa'],
      ]],
      ['Trades & Services', 'trades-services', [
        ['Construction & Carpentry', 'construction'],
        ['Plumbing & Electric', 'plumbing-electric'],
        ['Mechanics & Auto Repair', 'mechanics'],
        ['Landscaping & Tree Work', 'landscaping'],
        ['Cleaning & Home Services', 'home-services'],
      ]],
      ['Shops & Goods', 'shops-goods', [
        ['General Stores', 'general-stores'],
        ['Hardware', 'hardware'],
        ['Books & Stationery', 'books-stationery'],
        ['Antiques & Thrift', 'antiques-thrift'],
        ['Crafts & Handmade', 'crafts'],
      ]],
      ['Eat & Drink', 'eat-drink', [
        ['Restaurants & Diners', 'restaurants'],
        ['Cafes & Coffee', 'cafes'],
        ['Taverns & Breweries', 'taverns'],
      ]],
      ['Care & Wellness', 'care-wellness', [
        ['Doctors & Clinics', 'clinics'],
        ['Dentists', 'dentists'],
        ['Childcare', 'childcare'],
        ['Eldercare', 'eldercare'],
      ]],
      ['Faith & Civic', 'faith-civic', [
        ['Churches', 'churches'],
        ['Civic Clubs & Lodges', 'civic-clubs'],
        ['Volunteer Groups', 'volunteer-groups'],
      ]],
      ['Arts & Education', 'arts-education', [
        ['Music & Lessons', 'music-lessons'],
        ['Tutors & Schools', 'tutors-schools'],
        ['Studios & Galleries', 'studios-galleries'],
      ]],
    ];
    for (let i = 0; i < taxonomy.length; i++) {
      const [name, slug, kids] = taxonomy[i];
      const info = insertCat.run(name, slug, null, i);
      for (let j = 0; j < kids.length; j++) {
        const [kn, ks] = kids[j];
        insertCat.run(kn, ks, info.lastInsertRowid, j);
      }
    }
  }

  const bookCount = db
    .prepare("SELECT COUNT(*) AS n FROM books WHERE curated = 1")
    .get().n;
  if (bookCount === 0) {
    const insertBook = db.prepare(
      `INSERT INTO books (title, slug, author, year, description, why_we_read, curated, status)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'approved')`
    );
    const seedBooks = [
      [
        'The Unsettling of America',
        'unsettling-of-america',
        'Wendell Berry',
        '1977',
        'Berry traces the cultural and agricultural cost of treating land and people as exchangeable commodities.',
        'A patient case for why a healthy economy begins on the farm and at the kitchen table.',
      ],
      [
        'The Death and Life of Great American Cities',
        'death-and-life-of-great-american-cities',
        'Jane Jacobs',
        '1961',
        'Jacobs argues that cities live or die on the everyday details of their streets, blocks, and sidewalks. Small business, mixed use, short blocks, and eyes on the street: the unromantic mechanics of a place worth living in.',
        'Reads like it was written about a small county too. Most of what works in Dixon or Amboy works for the same reasons it works in Greenwich Village.',
      ],
      [
        'Small Is Beautiful',
        'small-is-beautiful',
        'E. F. Schumacher',
        '1973',
        'Subtitled "economics as if people mattered." Schumacher makes the case for appropriate scale, appropriate technology, and durable work.',
        'A good antidote to the assumption that bigger is automatically better.',
      ],
      [
        'Bowling Alone',
        'bowling-alone',
        'Robert D. Putnam',
        '2000',
        'Putnam tracks the long decline of civic and social life in American communities, from union halls to bridge clubs to Sunday dinners.',
        'Names what got lost, in the kind of detail you can argue with.',
      ],
    ];
    for (const b of seedBooks) insertBook.run(...b);
  }

  const aidCount = db
    .prepare("SELECT COUNT(*) AS n FROM aid_resources WHERE status = 'approved'")
    .get().n;
  if (aidCount === 0) {
    const insertAid = db.prepare(
      `INSERT INTO aid_resources (name, slug, category, description, town, address, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`
    );
    const seeds = [
      ['Dixon PADS', 'dixon-pads',
       'Shelter',
       'Public Action to Deliver Shelter. Emergency shelter and related services for people without housing in the Dixon area. Hours and intake vary by season.',
       'Dixon', null,
       'Call ahead. Volunteers and donations welcome.'],
      ['The Leydig Center', 'leydig-center',
       'Goods',
       'A volunteer-run thrift center in Dixon. Proceeds fund grants back into the community.',
       'Dixon', null, null],
      ['Habitat for Humanity of Lee County', 'habitat-lee-county',
       'Shelter',
       'Affordable housing partner serving Lee County. Take volunteer shifts on the build site, donate to the ReStore, or apply as a partner family.',
       'Dixon', '924 W First St, Dixon', null],
      ['Lee County Historical & Genealogical Society', 'lee-county-historical-society',
       'Other',
       'County records, genealogy research, and family history help. A good first stop when somebody asks "who lived in this house before us?"',
       'Dixon', '113 S Hennepin Ave, Dixon', null],
      ['United Way of Lee County', 'united-way-lee-county',
       'Other',
       'Local United Way affiliate. Community fundraising, partner agency referrals, and access to the 211 information line.',
       'Dixon', null, 'Dial 211 for non-emergency help finding services.'],
    ];
    for (const r of seeds) insertAid.run(...r);
  }
}
seed();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// 2 MB body to leave room for base64 logo uploads.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(table, base) {
  let slug = base || crypto.randomBytes(4).toString('hex');
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const row = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(slug);
    if (!row) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only.' });
  }
  next();
}

function trim(s, max = 5000) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function expireAidPosts() {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    "UPDATE aid_posts SET status = 'expired' WHERE status = 'approved' AND expires_at < ?"
  ).run(now);
}
setInterval(expireAidPosts, 1000 * 60 * 60).unref();
expireAidPosts();

const ALTCHA_HMAC =
  process.env.ALTCHA_HMAC || crypto.randomBytes(32).toString('hex');

async function makeAltchaChallenge() {
  return altcha.createChallenge({
    hmacKey: ALTCHA_HMAC,
    maxNumber: 200000,
    expires: new Date(Date.now() + 10 * 60 * 1000),
  });
}

// AltCha needs Web Crypto, so it only works over HTTPS. Until then we
// soft-fail.
const ALTCHA_ENFORCE = process.env.COOKIE_SECURE === 'true';

async function requireAltcha(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  const payload = req.body && req.body.altcha;
  if (!payload) {
    if (!ALTCHA_ENFORCE) return next();
    return res
      .status(400)
      .json({ error: 'Please complete the verification widget.' });
  }
  try {
    const ok = await altcha.verifySolution(payload, ALTCHA_HMAC);
    if (!ok) {
      if (!ALTCHA_ENFORCE) return next();
      return res
        .status(400)
        .json({ error: 'Verification failed. Please reload and try again.' });
    }
  } catch (_) {
    if (!ALTCHA_ENFORCE) return next();
    return res.status(400).json({ error: 'Verification failed.' });
  }
  next();
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (_) {
    return fallback;
  }
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, JSON.stringify(value));
}

const DEFAULT_DONATION = {
  goal_cents: 50000,
  raised_cents: 0,
  currency: 'USD',
  url: '',
  url_label: 'Donate',
  message:
    'Local Lee runs on a small budget. A few of the things we pay for are: hosting, the domain name, a bit of local advertising, supplies for our litter pick-up events, and a small bit of compensation to the people who help keep the site moderated, up to date, and running.',
};

app.post('/api/register', requireAltcha, (req, res) => {
  const email = trim(req.body.email, 254).toLowerCase();
  const password = trim(req.body.password, 200);
  const display = trim(req.body.display_name, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered.' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES (?, ?, ?, 'member')`
    )
    .run(email, hash, display || email.split('@')[0]);
  req.session.userId = info.lastInsertRowid;
  req.session.role = 'member';
  req.session.email = email;
  res.json({ ok: true, role: 'member', email });
});

app.post('/api/login', (req, res) => {
  const email = trim(req.body.email, 254).toLowerCase();
  const password = trim(req.body.password, 200);
  const user = db
    .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
    .get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.email = user.email;
  res.json({ ok: true, role: user.role, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const u = db
    .prepare('SELECT id, email, display_name, role FROM users WHERE id = ?')
    .get(req.session.userId);
  res.json({ user: u || null });
});

app.get('/api/categories', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, slug, parent_id, sort_order FROM categories ORDER BY sort_order, name')
    .all();
  res.json({ categories: rows });
});

app.get('/api/businesses', (req, res) => {
  const cat = req.query.category;
  const town = req.query.town;
  const q = req.query.q;
  let sql = `SELECT b.*, c.name AS category_name, c.slug AS category_slug,
                    p.name AS parent_name, p.slug AS parent_slug
             FROM businesses b
             LEFT JOIN categories c ON c.id = b.category_id
             LEFT JOIN categories p ON p.id = c.parent_id
             WHERE b.status = 'approved'`;
  const params = [];
  if (cat) {
    sql += ` AND (c.slug = ? OR p.slug = ?)`;
    params.push(cat, cat);
  }
  if (town) {
    sql += ` AND lower(b.town) = lower(?)`;
    params.push(town);
  }
  if (q) {
    sql += ` AND (b.name LIKE ? OR b.description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY b.name';
  res.json({ businesses: db.prepare(sql).all(...params) });
});

app.get('/api/businesses/:slug', (req, res) => {
  const row = db
    .prepare(
      `SELECT b.*, c.name AS category_name, c.slug AS category_slug
       FROM businesses b LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.slug = ? AND b.status = 'approved'`
    )
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json({ business: row });
});

app.post('/api/businesses', requireAltcha, (req, res) => {
  const name = trim(req.body.name, 120);
  const town = trim(req.body.town, 80);
  if (!name) return res.status(400).json({ error: 'Business name required.' });
  if (!town)
    return res
      .status(400)
      .json({ error: 'Please pick the Lee County town this business is in.' });
  const fields = {
    name,
    description: trim(req.body.description, 4000),
    category_id: parseInt(req.body.category_id, 10) || null,
    town,
    address: trim(req.body.address, 200),
    phone: trim(req.body.phone, 40),
    email: trim(req.body.email, 200),
    website: trim(req.body.website, 300),
    hours: trim(req.body.hours, 300),
  };
  const slug = uniqueSlug('businesses', slugify(name));
  const info = db
    .prepare(
      `INSERT INTO businesses (name, slug, description, category_id, town, address,
        phone, email, website, hours, submitted_by, status)
       VALUES (@name, @slug, @description, @category_id, @town, @address,
        @phone, @email, @website, @hours, @submitted_by, 'pending')`
    )
    .run({ ...fields, slug, submitted_by: req.session.userId || null });
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/businesses/:id/claim', requireAuth, requireAltcha, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const biz = db.prepare('SELECT id, claim_status FROM businesses WHERE id = ?').get(id);
  if (!biz) return res.status(404).json({ error: 'Not found.' });
  db.prepare(
    `UPDATE businesses SET claim_status = 'claim_pending', owner_user_id = ? WHERE id = ?`
  ).run(req.session.userId, id);
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const rows = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count
       FROM events e WHERE e.status = 'approved' AND e.starts_at >= ?
       ORDER BY e.starts_at ASC`
    )
    .all(now - 60 * 60 * 12);
  res.json({ events: rows });
});

app.get('/api/events/:slug', (req, res) => {
  const e = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count
       FROM events e WHERE e.slug = ? AND e.status = 'approved'`
    )
    .get(req.params.slug);
  if (!e) return res.status(404).json({ error: 'Not found.' });
  let rsvped = false;
  if (req.session.userId) {
    rsvped = !!db
      .prepare('SELECT 1 FROM event_rsvps WHERE event_id = ? AND user_id = ?')
      .get(e.id, req.session.userId);
  }
  res.json({ event: e, rsvped });
});

app.post('/api/events', requireAltcha, (req, res) => {
  const title = trim(req.body.title, 160);
  const startsAt = parseInt(req.body.starts_at, 10);
  if (!title) return res.status(400).json({ error: 'Title required.' });
  if (!startsAt) return res.status(400).json({ error: 'Start time required.' });
  const slug = uniqueSlug('events', slugify(title));
  const info = db
    .prepare(
      `INSERT INTO events (title, slug, description, starts_at, ends_at, location, town,
                           organizer, contact, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      title,
      slug,
      trim(req.body.description, 4000),
      startsAt,
      parseInt(req.body.ends_at, 10) || null,
      trim(req.body.location, 200),
      trim(req.body.town, 80),
      trim(req.body.organizer, 120),
      trim(req.body.contact, 200),
      req.session.userId || null
    );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/events/:id/rsvp', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const e = db.prepare("SELECT id FROM events WHERE id = ? AND status = 'approved'").get(id);
  if (!e) return res.status(404).json({ error: 'Not found.' });
  if (req.session.userId) {
    try {
      db.prepare('INSERT INTO event_rsvps (event_id, user_id) VALUES (?, ?)').run(
        id,
        req.session.userId
      );
    } catch (_) {
      /* duplicate, ignore */
    }
  } else {
    if (!req.session.guestToken)
      req.session.guestToken = crypto.randomBytes(12).toString('hex');
    try {
      db.prepare(
        'INSERT INTO event_rsvps (event_id, guest_token) VALUES (?, ?)'
      ).run(id, req.session.guestToken);
    } catch (_) {
      /* duplicate */
    }
  }
  const count = db
    .prepare('SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ?')
    .get(id).n;
  res.json({ ok: true, count });
});

app.get('/api/books', (req, res) => {
  const curated = req.query.curated;
  let sql = "SELECT * FROM books WHERE status = 'approved'";
  if (curated === '1') sql += ' AND curated = 1';
  if (curated === '0') sql += ' AND curated = 0';
  sql += ' ORDER BY curated DESC, title';
  res.json({ books: db.prepare(sql).all() });
});

app.get('/api/books/:slug', (req, res) => {
  const b = db
    .prepare("SELECT * FROM books WHERE slug = ? AND status = 'approved'")
    .get(req.params.slug);
  if (!b) return res.status(404).json({ error: 'Not found.' });
  const comments = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.display_name, u.email
       FROM book_comments c JOIN users u ON u.id = c.user_id
       WHERE c.book_id = ? AND c.status = 'approved' ORDER BY c.created_at DESC`
    )
    .all(b.id);
  res.json({ book: b, comments });
});

app.post('/api/books', requireAltcha, (req, res) => {
  const title = trim(req.body.title, 200);
  if (!title) return res.status(400).json({ error: 'Title required.' });
  const slug = uniqueSlug('books', slugify(title));
  const info = db
    .prepare(
      `INSERT INTO books (title, slug, author, year, description, why_we_read,
                          curated, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'pending')`
    )
    .run(
      title,
      slug,
      trim(req.body.author, 120),
      trim(req.body.year, 20),
      trim(req.body.description, 4000),
      trim(req.body.why_we_read, 2000),
      req.session.userId || null
    );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/books/:id/comments', requireAuth, requireAltcha, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = trim(req.body.body, 4000);
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  const book = db.prepare("SELECT id FROM books WHERE id = ? AND status = 'approved'").get(id);
  if (!book) return res.status(404).json({ error: 'Not found.' });
  db.prepare(
    "INSERT INTO book_comments (book_id, user_id, body, status) VALUES (?, ?, ?, 'approved')"
  ).run(id, req.session.userId, body);
  res.json({ ok: true });
});

app.get('/api/aid/resources', (req, res) => {
  const cat = req.query.category;
  let sql = "SELECT * FROM aid_resources WHERE status = 'approved'";
  const params = [];
  if (cat) {
    sql += ' AND lower(category) = lower(?)';
    params.push(cat);
  }
  sql += ' ORDER BY category, name';
  res.json({ resources: db.prepare(sql).all(...params) });
});

app.post('/api/aid/resources', requireAltcha, (req, res) => {
  const name = trim(req.body.name, 160);
  const category = trim(req.body.category, 80);
  if (!name) return res.status(400).json({ error: 'Name required.' });
  if (!category) return res.status(400).json({ error: 'Category required.' });
  const slug = uniqueSlug('aid_resources', slugify(name));
  const info = db
    .prepare(
      `INSERT INTO aid_resources (name, slug, category, description, town, address,
        phone, website, hours, notes, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      name,
      slug,
      category,
      trim(req.body.description, 4000),
      trim(req.body.town, 80),
      trim(req.body.address, 200),
      trim(req.body.phone, 40),
      trim(req.body.website, 300),
      trim(req.body.hours, 300),
      trim(req.body.notes, 2000),
      req.session.userId || null
    );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get('/api/aid/posts', (req, res) => {
  expireAidPosts();
  const kind = req.query.kind;
  let sql =
    "SELECT id, kind, title, body, category, town, contact_name, expires_at, created_at" +
    " FROM aid_posts WHERE status = 'approved'";
  const params = [];
  if (kind === 'need' || kind === 'offer') {
    sql += ' AND kind = ?';
    params.push(kind);
  }
  sql += ' ORDER BY created_at DESC';
  res.json({ posts: db.prepare(sql).all(...params) });
});

app.get('/api/aid/posts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db
    .prepare("SELECT * FROM aid_posts WHERE id = ? AND status = 'approved'")
    .get(id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.json({ post: row });
});

app.post('/api/aid/posts', requireAltcha, (req, res) => {
  const kind = req.body.kind === 'need' ? 'need' : req.body.kind === 'offer' ? 'offer' : null;
  if (!kind) return res.status(400).json({ error: 'kind must be need or offer.' });
  const title = trim(req.body.title, 160);
  const body = trim(req.body.body, 4000);
  const contact = trim(req.body.contact, 200);
  if (!title || !body)
    return res.status(400).json({ error: 'Title and body required.' });
  if (!contact)
    return res.status(400).json({ error: 'Please share at least one way to reach you.' });
  const expires = Math.floor(Date.now() / 1000) + POST_TTL_DAYS * 24 * 60 * 60;
  const info = db
    .prepare(
      `INSERT INTO aid_posts (kind, title, body, category, town, contact, contact_name,
                              submitted_by, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      kind,
      title,
      body,
      trim(req.body.category, 80),
      trim(req.body.town, 80),
      contact,
      trim(req.body.contact_name, 80),
      req.session.userId || null,
      expires
    );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post('/api/contact', requireAltcha, (req, res) => {
  const name = trim(req.body.name, 120);
  const email = trim(req.body.email, 254);
  const message = trim(req.body.message, 4000);
  if (!name || !message) return res.status(400).json({ error: 'Name and message required.' });
  console.log(`[contact] ${new Date().toISOString()} from=${name}<${email}>: ${message}`);
  res.json({ ok: true });
});

app.get('/api/admin/queue', requireAdmin, (req, res) => {
  const businesses = db
    .prepare(
      `SELECT b.*, c.name AS category_name FROM businesses b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.status = 'pending' OR b.claim_status = 'claim_pending' ORDER BY b.created_at DESC`
    )
    .all();
  const events = db
    .prepare("SELECT * FROM events WHERE status = 'pending' ORDER BY created_at DESC")
    .all();
  const books = db
    .prepare("SELECT * FROM books WHERE status = 'pending' ORDER BY created_at DESC")
    .all();
  const aidResources = db
    .prepare("SELECT * FROM aid_resources WHERE status = 'pending' ORDER BY created_at DESC")
    .all();
  const aidPosts = db
    .prepare("SELECT * FROM aid_posts WHERE status = 'pending' ORDER BY created_at DESC")
    .all();
  res.json({ businesses, events, books, aidResources, aidPosts });
});

const APPROVABLE = {
  business: 'businesses',
  event: 'events',
  book: 'books',
  aidResource: 'aid_resources',
  aidPost: 'aid_posts',
};
const DELETABLE = {
  ...APPROVABLE,
  thread: 'threads',
  reply: 'thread_replies',
  newsletter: 'newsletters',
  topic: 'topic_suggestions',
  'book-comment': 'book_comments',
  'newsletter-comment': 'newsletter_comments',
};

app.post('/api/admin/:type/:id/approve', requireAdmin, (req, res) => {
  const table = APPROVABLE[req.params.type];
  if (!table) return res.status(400).json({ error: 'Unknown type.' });
  const id = parseInt(req.params.id, 10);
  db.prepare(`UPDATE ${table} SET status = 'approved' WHERE id = ?`).run(id);
  res.json({ ok: true });
});

app.post('/api/admin/:type/:id/reject', requireAdmin, (req, res) => {
  const table = APPROVABLE[req.params.type];
  if (!table) return res.status(400).json({ error: 'Unknown type.' });
  const id = parseInt(req.params.id, 10);
  db.prepare(`UPDATE ${table} SET status = 'rejected' WHERE id = ?`).run(id);
  res.json({ ok: true });
});

app.post('/api/admin/business/:id/claim/approve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare(
    "UPDATE businesses SET claim_status = 'claimed' WHERE id = ?"
  ).run(id);
  res.json({ ok: true });
});

app.post('/api/admin/business/:id/claim/reject', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare(
    "UPDATE businesses SET claim_status = 'unclaimed', owner_user_id = NULL WHERE id = ?"
  ).run(id);
  res.json({ ok: true });
});

app.get('/api/admin/business/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const business = db
    .prepare(
      `SELECT b.*, c.name AS category_name, c.slug AS category_slug
       FROM businesses b LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.id = ?`
    )
    .get(id);
  if (!business) return res.status(404).json({ error: 'Not found.' });
  res.json({ business });
});

app.post('/api/admin/business/:id/edit', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  const b = req.body || {};
  const fieldOrCurrent = (val, max, current) =>
    val === undefined ? current : (trim(val, max) || null);

  const name = trim(b.name, 120) || existing.name;
  if (!name) return res.status(400).json({ error: 'Name required.' });

  const allowedStatus = ['approved', 'pending', 'rejected'];
  const status = allowedStatus.includes(b.status) ? b.status : existing.status;

  let categoryId = existing.category_id;
  if (b.category_id !== undefined) {
    const n = parseInt(b.category_id, 10);
    categoryId = Number.isFinite(n) && n > 0 ? n : null;
  }

  db.prepare(
    `UPDATE businesses
     SET name = ?, description = ?, category_id = ?, town = ?, address = ?,
         phone = ?, email = ?, website = ?, hours = ?, status = ?
     WHERE id = ?`
  ).run(
    name,
    fieldOrCurrent(b.description, 4000, existing.description),
    categoryId,
    fieldOrCurrent(b.town, 80, existing.town),
    fieldOrCurrent(b.address, 200, existing.address),
    fieldOrCurrent(b.phone, 40, existing.phone),
    fieldOrCurrent(b.email, 200, existing.email),
    fieldOrCurrent(b.website, 300, existing.website),
    fieldOrCurrent(b.hours, 300, existing.hours),
    status,
    id
  );
  res.json({ ok: true });
});

app.post('/api/admin/:type/:id/delete', requireAdmin, (req, res) => {
  const table = DELETABLE[req.params.type];
  if (!table) return res.status(400).json({ error: 'Unknown type: ' + req.params.type });
  const id = parseInt(req.params.id, 10);
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});

app.get('/api/admin/all', requireAdmin, (req, res) => {
  const businesses = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.town, b.status, b.claim_status,
              c.name AS category_name
       FROM businesses b LEFT JOIN categories c ON c.id = b.category_id
       ORDER BY b.created_at DESC`
    )
    .all();
  const events = db
    .prepare(
      `SELECT id, title, slug, town, starts_at, status FROM events
       ORDER BY starts_at DESC`
    )
    .all();
  const books = db
    .prepare(
      `SELECT id, title, slug, author, year, curated, status FROM books
       ORDER BY curated DESC, created_at DESC`
    )
    .all();
  const aidResources = db
    .prepare(
      `SELECT id, name, slug, category, town, status FROM aid_resources
       ORDER BY created_at DESC`
    )
    .all();
  const aidPosts = db
    .prepare(
      `SELECT id, kind, title, town, category, status, expires_at, created_at
       FROM aid_posts ORDER BY created_at DESC`
    )
    .all();
  const bookComments = db
    .prepare(
      `SELECT bc.id, bc.body, bc.created_at, b.title AS book_title, b.slug AS book_slug,
              u.email, u.display_name
       FROM book_comments bc
       JOIN books b ON b.id = bc.book_id
       JOIN users u ON u.id = bc.user_id
       ORDER BY bc.created_at DESC LIMIT 200`
    )
    .all();
  res.json({ businesses, events, books, aidResources, aidPosts, bookComments });
});

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n') {
      row.push(cur); rows.push(row); row = []; cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim().length));
}

function normalizeMatch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const IMPORT_COLS = ['name', 'category', 'town', 'description', 'address', 'phone', 'email', 'website', 'hours'];

app.get('/api/admin/business-import/template', requireAdmin, (req, res) => {
  const sample =
    'name,category,town,description,address,phone,email,website,hours\n' +
    '"Joe\'s Diner",restaurants,Dixon,"Family-run diner since 1972, breakfast all day.","123 Main St, Dixon, IL","(815) 555-0101",info@example.com,https://example.com,"Mon-Sat 6a-9p"\n' +
    '"Hometown Hardware",hardware,Amboy,"Hand tools, paint, fencing, fasteners.","42 E Main St, Amboy, IL","(815) 555-0202",,,"Mon-Fri 7a-6p, Sat 8a-4p"\n';
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="business-import-template.csv"');
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.send(sample);
});

app.post('/api/admin/business-import', requireAdmin, (req, res) => {
  const csv = req.body && req.body.csv;
  if (typeof csv !== 'string' || !csv.trim())
    return res.status(400).json({ error: 'No CSV content uploaded.' });
  const rows = parseCSV(csv);
  if (rows.length < 2)
    return res.status(400).json({ error: 'CSV needs a header row and at least one data row.' });
  const header = rows[0].map(h => h.trim().toLowerCase());
  const colIdx = {};
  for (const col of IMPORT_COLS) colIdx[col] = header.indexOf(col);
  if (colIdx.name === -1 || colIdx.town === -1)
    return res.status(400).json({ error: 'CSV must include at least "name" and "town" columns. See the template.' });

  const cats = db.prepare('SELECT id, name, slug FROM categories').all();
  const catBySlug = new Map();
  const catByName = new Map();
  for (const c of cats) {
    catBySlug.set(c.slug.toLowerCase(), c);
    catByName.set(c.name.toLowerCase(), c);
  }

  const existing = db.prepare('SELECT id, name, town FROM businesses').all();
  const dupKey = new Map();
  for (const b of existing) {
    const k = normalizeMatch(b.name) + '|' + normalizeMatch(b.town || '');
    dupKey.set(k, b);
  }

  const batchId = crypto.randomBytes(6).toString('hex');
  const insert = db.prepare(
    `INSERT INTO business_imports (uploaded_by, row_data, duplicate_of, status, batch_id)
     VALUES (?, ?, ?, ?, ?)`
  );

  const skipped = [];
  let queued = 0;
  let conflicts = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const data = {};
    for (const col of IMPORT_COLS) {
      if (colIdx[col] !== -1) data[col] = trim(row[colIdx[col]] || '', col === 'description' ? 4000 : 300);
    }
    if (!data.name || !data.town) {
      skipped.push({ row: i + 1, reason: 'Missing required field (name or town).' });
      continue;
    }
    if (data.category) {
      const cat =
        catBySlug.get(data.category.toLowerCase()) ||
        catByName.get(data.category.toLowerCase());
      if (cat) {
        data.category_id = cat.id;
        data.category_label = cat.name;
      } else {
        data.category_label = data.category;
        data.category_warning = 'No matching category - leave blank or set in admin.';
      }
    }
    const key = normalizeMatch(data.name) + '|' + normalizeMatch(data.town);
    const dup = dupKey.get(key);
    if (dup) conflicts++;
    insert.run(
      req.session.userId,
      JSON.stringify(data),
      dup ? dup.id : null,
      dup ? 'conflict' : 'pending',
      batchId
    );
    queued++;
  }

  res.json({
    ok: true,
    batch_id: batchId,
    total_rows: rows.length - 1,
    queued,
    conflicts,
    skipped,
  });
});

app.get('/api/admin/business-import', requireAdmin, (req, res) => {
  const open = db
    .prepare(
      `SELECT bi.*, b.name AS existing_name, b.town AS existing_town,
              b.description AS existing_description, b.address AS existing_address,
              b.phone AS existing_phone, b.email AS existing_email,
              b.website AS existing_website, b.hours AS existing_hours,
              b.category_id AS existing_category_id, b.status AS existing_status,
              c.name AS existing_category_name
       FROM business_imports bi
       LEFT JOIN businesses b ON b.id = bi.duplicate_of
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE bi.status IN ('pending','conflict')
       ORDER BY bi.uploaded_at, bi.id`
    )
    .all();
  for (const r of open) {
    try { r.data = JSON.parse(r.row_data); } catch (_) { r.data = {}; }
    delete r.row_data;
  }
  const resolved = db
    .prepare(
      `SELECT COUNT(*) AS n FROM business_imports WHERE status IN ('applied','rejected')`
    )
    .get().n;
  res.json({ pending: open, resolved_count: resolved });
});

app.post('/api/admin/business-import/:id/resolve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const action = req.body && req.body.action;
  const overrides = (req.body && req.body.fields) || {};
  const row = db.prepare('SELECT * FROM business_imports WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'pending' && row.status !== 'conflict')
    return res.status(400).json({ error: 'Row already resolved.' });

  let data;
  try { data = JSON.parse(row.row_data); } catch (_) {
    return res.status(400).json({ error: 'Corrupt row data.' });
  }
  const merged = { ...data, ...overrides };

  const fail = (msg) => res.status(400).json({ error: msg });

  if (action === 'reject') {
    db.prepare("UPDATE business_imports SET status='rejected', resolution='rejected' WHERE id=?").run(id);
    return res.json({ ok: true });
  }

  if (action === 'keep_existing') {
    if (row.status !== 'conflict') return fail('Action only valid for conflicts.');
    db.prepare("UPDATE business_imports SET status='rejected', resolution='kept_existing' WHERE id=?").run(id);
    return res.json({ ok: true });
  }

  if (action === 'create' || action === 'add_separate') {
    if (action === 'add_separate' && row.status !== 'conflict')
      return fail('add_separate is for conflict rows.');
    if (action === 'create' && row.status !== 'pending')
      return fail('create is for new (non-conflict) rows.');
    if (!merged.name || !merged.town)
      return fail('Name and town are required.');
    const slug = uniqueSlug('businesses', slugify(merged.name));
    const info = db
      .prepare(
        `INSERT INTO businesses (name, slug, description, category_id, town, address,
          phone, email, website, hours, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`
      )
      .run(
        merged.name,
        slug,
        merged.description || null,
        parseInt(merged.category_id, 10) || null,
        merged.town || null,
        merged.address || null,
        merged.phone || null,
        merged.email || null,
        merged.website || null,
        merged.hours || null
      );
    db.prepare(
      "UPDATE business_imports SET status='applied', resolution=? WHERE id=?"
    ).run(action === 'create' ? 'created' : 'created_separate', id);
    return res.json({ ok: true, business_id: info.lastInsertRowid });
  }

  if (action === 'overwrite') {
    if (row.status !== 'conflict') return fail('overwrite is for conflict rows.');
    if (!row.duplicate_of) return fail('No duplicate target.');
    db.prepare(
      `UPDATE businesses
       SET description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           address = COALESCE(?, address),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           website = COALESCE(?, website),
           hours = COALESCE(?, hours)
       WHERE id = ?`
    ).run(
      merged.description || null,
      parseInt(merged.category_id, 10) || null,
      merged.address || null,
      merged.phone || null,
      merged.email || null,
      merged.website || null,
      merged.hours || null,
      row.duplicate_of
    );
    db.prepare(
      "UPDATE business_imports SET status='applied', resolution='overwritten' WHERE id=?"
    ).run(id);
    return res.json({ ok: true, business_id: row.duplicate_of });
  }

  return fail('Unknown action: ' + action);
});

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_LOGO_MIMES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const DEFAULT_BRAND_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Local Lee">
  <circle cx="32" cy="32" r="30" fill="#c89c4d" stroke="#3e2810" stroke-width="2"/>
  <ellipse cx="22" cy="24" rx="3" ry="7" fill="#f5ecd7" stroke="#3e2810" stroke-width="1.2" transform="rotate(-25 22 24)"/>
  <ellipse cx="42" cy="24" rx="3" ry="7" fill="#f5ecd7" stroke="#3e2810" stroke-width="1.2" transform="rotate(25 42 24)"/>
  <ellipse cx="32" cy="20" rx="3" ry="7" fill="#f5ecd7" stroke="#3e2810" stroke-width="1.2"/>
  <path d="M32 28 v22" stroke="#3e2810" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 52 q24 -8 48 0 v6 h-48 z" fill="#5a3a1b" stroke="#3e2810" stroke-width="1.5"/>
</svg>
`;

function logoMeta() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(UPLOAD_DIR, 'logo.json'), 'utf8')
    );
  } catch (_) {
    return null;
  }
}

const BUNDLED_LOGO_CANDIDATES = [
  ['logo.png', 'image/png'],
  ['logo.jpg', 'image/jpeg'],
  ['logo.webp', 'image/webp'],
  ['logo.svg', 'image/svg+xml'],
];

app.get('/brand-mark', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  const meta = logoMeta();
  if (meta) {
    const filePath = path.join(UPLOAD_DIR, meta.file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.set('ETag', '"' + stat.size + '-' + stat.mtimeMs + '"');
      res.set('Last-Modified', stat.mtime.toUTCString());
      res.set('Content-Type', meta.mime);
      return fs.createReadStream(filePath).pipe(res);
    }
  }
  for (const [name, mime] of BUNDLED_LOGO_CANDIDATES) {
    const p = path.join(__dirname, 'public', 'img', name);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      res.set('ETag', '"' + stat.size + '-' + stat.mtimeMs + '"');
      res.set('Last-Modified', stat.mtime.toUTCString());
      res.set('Content-Type', mime);
      return fs.createReadStream(p).pipe(res);
    }
  }
  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  res.send(DEFAULT_BRAND_SVG);
});

app.get('/api/admin/logo', requireAdmin, (req, res) => {
  res.json({ logo: logoMeta() });
});

app.post('/api/admin/logo', requireAdmin, (req, res) => {
  const dataUrl = req.body && req.body.data;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:'))
    return res.status(400).json({ error: 'Send a base64 data URL in `data`.' });
  const m = dataUrl.match(/^data:([\w/+\-.]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Malformed data URL.' });
  const mime = m[1].toLowerCase();
  const ext = ALLOWED_LOGO_MIMES[mime];
  if (!ext)
    return res
      .status(400)
      .json({ error: 'Unsupported image type. Use PNG, JPEG, SVG, WebP, or GIF.' });
  let buf;
  try {
    buf = Buffer.from(m[2], 'base64');
  } catch (_) {
    return res.status(400).json({ error: 'Invalid base64.' });
  }
  if (buf.length > 1024 * 1024)
    return res.status(413).json({ error: 'Logo must be 1 MB or smaller.' });
  for (const e of new Set(Object.values(ALLOWED_LOGO_MIMES))) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, 'logo.' + e)); } catch (_) {}
  }
  const filename = 'logo.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  fs.writeFileSync(
    path.join(UPLOAD_DIR, 'logo.json'),
    JSON.stringify({ file: filename, mime, updated: Date.now() })
  );
  res.json({ ok: true });
});

app.post('/api/admin/logo/reset', requireAdmin, (req, res) => {
  for (const e of new Set(Object.values(ALLOWED_LOGO_MIMES))) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, 'logo.' + e)); } catch (_) {}
  }
  try { fs.unlinkSync(path.join(UPLOAD_DIR, 'logo.json')); } catch (_) {}
  res.json({ ok: true });
});

app.get('/api/altcha/challenge', async (req, res) => {
  try {
    const challenge = await makeAltchaChallenge();
    res.set('Cache-Control', 'no-store');
    res.json(challenge);
  } catch (err) {
    res.status(500).json({ error: 'Could not create challenge.' });
  }
});

app.get('/api/newsletter', (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.slug, n.published_at, n.created_at,
              substr(n.body, 1, 280) AS excerpt,
              u.display_name AS author_name
       FROM newsletters n LEFT JOIN users u ON u.id = n.author_id
       WHERE n.status = 'published'
       ORDER BY n.published_at DESC, n.created_at DESC`
    )
    .all();
  res.json({ posts: rows });
});

app.get('/api/newsletter/:slug', (req, res) => {
  const post = db
    .prepare(
      `SELECT n.*, u.display_name AS author_name
       FROM newsletters n LEFT JOIN users u ON u.id = n.author_id
       WHERE n.slug = ? AND n.status = 'published'`
    )
    .get(req.params.slug);
  if (!post) return res.status(404).json({ error: 'Not found.' });
  const comments = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, u.id AS user_id,
              u.display_name, u.email, u.avatar_ext
       FROM newsletter_comments c JOIN users u ON u.id = c.user_id
       WHERE c.newsletter_id = ? ORDER BY c.created_at ASC`
    )
    .all(post.id);
  res.json({ post, comments });
});

app.post('/api/newsletter/:id/comments', requireAuth, requireAltcha, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = trim(req.body.body, 4000);
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  const ok = db.prepare("SELECT 1 FROM newsletters WHERE id = ? AND status='published'").get(id);
  if (!ok) return res.status(404).json({ error: 'Not found.' });
  db.prepare(
    'INSERT INTO newsletter_comments (newsletter_id, user_id, body) VALUES (?, ?, ?)'
  ).run(id, req.session.userId, body);
  res.json({ ok: true });
});

app.post('/api/newsletter/topics', requireAltcha, (req, res) => {
  const body = trim(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Tell us what you would like to read about.' });
  db.prepare(
    'INSERT INTO topic_suggestions (body, contact, contact_name) VALUES (?, ?, ?)'
  ).run(
    body,
    trim(req.body.contact, 200),
    trim(req.body.contact_name, 80)
  );
  res.json({ ok: true });
});

// Newsletter (admin)
app.get('/api/admin/newsletter', requireAdmin, (req, res) => {
  const posts = db
    .prepare('SELECT * FROM newsletters ORDER BY created_at DESC')
    .all();
  const topics = db
    .prepare('SELECT * FROM topic_suggestions ORDER BY created_at DESC')
    .all();
  res.json({ posts, topics });
});

app.post('/api/admin/newsletter', requireAdmin, (req, res) => {
  const title = trim(req.body.title, 200);
  const rawBody = trim(req.body.body, 60000);
  if (!title) return res.status(400).json({ error: 'Title required.' });
  if (!rawBody) return res.status(400).json({ error: 'Body required.' });
  const body = sanitizeHtml(rawBody, NEWSLETTER_HTML);
  if (!body.replace(/<[^>]+>/g, '').trim())
    return res.status(400).json({ error: 'Body looks empty after stripping tags.' });
  const slug = uniqueSlug('newsletters', slugify(title));
  const status = req.body.publish ? 'published' : 'draft';
  const publishedAt = status === 'published' ? Math.floor(Date.now() / 1000) : null;
  const info = db
    .prepare(
      `INSERT INTO newsletters (title, slug, body, status, author_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, slug, body, status, req.session.userId, publishedAt);
  res.json({ ok: true, id: info.lastInsertRowid, slug });
});

app.post('/api/admin/newsletter/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM newsletters WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  const title = trim(req.body.title, 200) || existing.title;
  const rawBody = trim(req.body.body, 60000);
  const body = rawBody ? sanitizeHtml(rawBody, NEWSLETTER_HTML) : existing.body;
  let status = existing.status;
  let publishedAt = existing.published_at;
  if (req.body.publish === true) {
    status = 'published';
    if (!publishedAt) publishedAt = Math.floor(Date.now() / 1000);
  } else if (req.body.publish === false) {
    status = 'draft';
  }
  db.prepare(
    `UPDATE newsletters SET title = ?, body = ?, status = ?, published_at = ? WHERE id = ?`
  ).run(title, body, status, publishedAt, id);
  res.json({ ok: true });
});

app.get('/api/threads', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.slug, t.locked, t.last_activity_at, t.created_at,
              u.id AS user_id, u.display_name, u.email, u.avatar_ext,
              (SELECT COUNT(*) FROM thread_replies r WHERE r.thread_id = t.id) AS reply_count
       FROM threads t LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.last_activity_at DESC LIMIT 200`
    )
    .all();
  res.json({ threads: rows });
});

app.get('/api/threads/:slug', (req, res) => {
  const thread = db
    .prepare(
      `SELECT t.*, u.display_name, u.email, u.avatar_ext
       FROM threads t LEFT JOIN users u ON u.id = t.user_id
       WHERE t.slug = ?`
    )
    .get(req.params.slug);
  if (!thread) return res.status(404).json({ error: 'Not found.' });
  const replies = db
    .prepare(
      `SELECT r.id, r.body, r.created_at, u.id AS user_id,
              u.display_name, u.email, u.avatar_ext
       FROM thread_replies r JOIN users u ON u.id = r.user_id
       WHERE r.thread_id = ? ORDER BY r.created_at ASC`
    )
    .all(thread.id);
  res.json({ thread, replies });
});

app.post('/api/threads', requireAuth, requireAltcha, (req, res) => {
  const title = trim(req.body.title, 200);
  const body = trim(req.body.body, 8000);
  if (!title || !body)
    return res.status(400).json({ error: 'Title and body required.' });
  const slug = uniqueSlug('threads', slugify(title));
  const info = db
    .prepare(
      'INSERT INTO threads (title, slug, body, user_id) VALUES (?, ?, ?, ?)'
    )
    .run(title, slug, body, req.session.userId);
  res.json({ ok: true, id: info.lastInsertRowid, slug });
});

app.post('/api/threads/:id/replies', requireAuth, requireAltcha, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = trim(req.body.body, 8000);
  if (!body) return res.status(400).json({ error: 'Reply cannot be empty.' });
  const t = db.prepare('SELECT id, locked FROM threads WHERE id = ?').get(id);
  if (!t) return res.status(404).json({ error: 'Not found.' });
  if (t.locked) return res.status(403).json({ error: 'This thread is locked.' });
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'INSERT INTO thread_replies (thread_id, user_id, body) VALUES (?, ?, ?)'
  ).run(id, req.session.userId, body);
  db.prepare('UPDATE threads SET last_activity_at = ? WHERE id = ?').run(now, id);
  res.json({ ok: true });
});

app.post('/api/admin/thread/:id/lock', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const locked = req.body.locked ? 1 : 0;
  db.prepare('UPDATE threads SET locked = ? WHERE id = ?').run(locked, id);
  res.json({ ok: true });
});

app.get('/api/donation', (req, res) => {
  const data = getSetting('donation', DEFAULT_DONATION);
  res.json({ donation: { ...DEFAULT_DONATION, ...data } });
});

app.post('/api/admin/donation', requireAdmin, (req, res) => {
  const current = { ...DEFAULT_DONATION, ...getSetting('donation', DEFAULT_DONATION) };
  const next = {
    goal_cents: Math.max(0, parseInt(req.body.goal_cents, 10) || current.goal_cents),
    raised_cents:
      req.body.raised_cents === '' || typeof req.body.raised_cents === 'undefined'
        ? current.raised_cents
        : Math.max(0, parseInt(req.body.raised_cents, 10) || 0),
    currency: trim(req.body.currency, 8) || current.currency,
    url: trim(req.body.url, 400),
    url_label: trim(req.body.url_label, 60) || 'Donate',
    message: trim(req.body.message, 4000) || current.message,
  };
  setSetting('donation', next);
  res.json({ ok: true, donation: next });
});

const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ALLOWED_AVATAR_MIMES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const MONOGRAM_PALETTE = [
  '#5d6f3a', '#5a3a1b', '#8b3a2a', '#c89c4d',
  '#3f4f25', '#6b5c3f', '#a8b9b1', '#3e2810',
];

function monogramFor(user) {
  const name = (user.display_name || user.email || 'L').trim();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'L';
  const hash = crypto.createHash('md5').update(name).digest();
  const bg = MONOGRAM_PALETTE[hash[0] % MONOGRAM_PALETTE.length];
  const safe = initials.replace(/[<>"'&]/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${safe}">
  <rect width="64" height="64" rx="32" fill="${bg}"/>
  <text x="32" y="40" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#fbf6e8" font-weight="600">${safe}</text>
</svg>
`;
}

app.get('/avatar/:userId', (req, res) => {
  const id = parseInt(req.params.userId, 10);
  const user = db
    .prepare('SELECT id, email, display_name, avatar_ext FROM users WHERE id = ?')
    .get(id);
  res.set('Cache-Control', 'no-cache, must-revalidate');
  if (!user) {
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.send(monogramFor({ display_name: 'L' }));
  }
  if (user.avatar_ext) {
    const file = path.join(AVATAR_DIR, `${user.id}.${user.avatar_ext}`);
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      const mime =
        user.avatar_ext === 'png' ? 'image/png' :
        user.avatar_ext === 'jpg' ? 'image/jpeg' : 'image/webp';
      res.set('ETag', '"' + stat.size + '-' + stat.mtimeMs + '"');
      res.set('Last-Modified', stat.mtime.toUTCString());
      res.set('Content-Type', mime);
      return fs.createReadStream(file).pipe(res);
    }
  }
  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  res.send(monogramFor(user));
});

app.get('/api/me/profile', requireAuth, (req, res) => {
  const u = db
    .prepare('SELECT id, email, display_name, bio, avatar_ext, role FROM users WHERE id = ?')
    .get(req.session.userId);
  res.json({ user: u });
});

app.post('/api/me/profile', requireAuth, (req, res) => {
  const display = trim(req.body.display_name, 80);
  const bio = trim(req.body.bio, 400);
  db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(
    display || null,
    bio || null,
    req.session.userId
  );
  res.json({ ok: true });
});

app.post('/api/me/avatar', requireAuth, (req, res) => {
  const dataUrl = req.body && req.body.data;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:'))
    return res.status(400).json({ error: 'Send a base64 data URL in `data`.' });
  const m = dataUrl.match(/^data:([\w/+\-.]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Malformed data URL.' });
  const mime = m[1].toLowerCase();
  const ext = ALLOWED_AVATAR_MIMES[mime];
  if (!ext) return res.status(400).json({ error: 'Use PNG, JPEG, or WebP.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 256 * 1024)
    return res.status(413).json({ error: 'Avatar must be 256 KB or smaller.' });
  for (const e of new Set(Object.values(ALLOWED_AVATAR_MIMES))) {
    try { fs.unlinkSync(path.join(AVATAR_DIR, `${req.session.userId}.${e}`)); } catch (_) {}
  }
  fs.writeFileSync(path.join(AVATAR_DIR, `${req.session.userId}.${ext}`), buf);
  db.prepare('UPDATE users SET avatar_ext = ? WHERE id = ?').run(
    ext,
    req.session.userId
  );
  res.json({ ok: true });
});

app.post('/api/me/avatar/reset', requireAuth, (req, res) => {
  for (const e of new Set(Object.values(ALLOWED_AVATAR_MIMES))) {
    try { fs.unlinkSync(path.join(AVATAR_DIR, `${req.session.userId}.${e}`)); } catch (_) {}
  }
  db.prepare('UPDATE users SET avatar_ext = NULL WHERE id = ?').run(
    req.session.userId
  );
  res.json({ ok: true });
});

app.get('/sitemap.xml', (req, res) => {
  const urls = [
    '/', '/about', '/contact', '/directory', '/events', '/literature', '/mutual-aid',
  ];
  const rows = [
    ...db.prepare("SELECT slug FROM businesses WHERE status='approved'").all().map(r => `/directory/${r.slug}`),
    ...db.prepare("SELECT slug FROM events WHERE status='approved'").all().map(r => `/events/${r.slug}`),
    ...db.prepare("SELECT slug FROM books WHERE status='approved'").all().map(r => `/literature/${r.slug}`),
    ...db.prepare("SELECT slug FROM newsletters WHERE status='published'").all().map(r => `/newsletter/${r.slug}`),
    ...db.prepare('SELECT slug FROM threads').all().map(r => `/discussion/${r.slug}`),
    '/newsletter', '/discussion', '/donate',
  ];
  const all = urls.concat(rows);
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    all
      .map(
        (u) =>
          `  <url><loc>${SITE_URL}${u}</loc><changefreq>weekly</changefreq></url>`
      )
      .join('\n') +
    '\n</urlset>\n';
  res.set('Content-Type', 'application/xml').send(xml);
});

const pages = {
  '/': 'index.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/directory': 'directory.html',
  '/events': 'events.html',
  '/literature': 'literature.html',
  '/mutual-aid': 'mutual-aid.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/admin': 'admin.html',
  '/submit/business': 'submit-business.html',
  '/submit/event': 'submit-event.html',
  '/submit/book': 'submit-book.html',
  '/submit/aid-resource': 'submit-aid-resource.html',
  '/submit/aid-post': 'submit-aid-post.html',
  '/newsletter': 'newsletter.html',
  '/newsletter/suggest': 'newsletter-suggest.html',
  '/discussion': 'discussion.html',
  '/discussion/new': 'discussion-new.html',
  '/donate': 'donate.html',
  '/profile': 'profile.html',
};
function sendHtml(res, file) {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', file));
}
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => sendHtml(res, file));
}

app.get('/directory/:slug', (req, res) => sendHtml(res, 'business.html'));
app.get('/events/:slug', (req, res) => sendHtml(res, 'event.html'));
app.get('/literature/:slug', (req, res) => sendHtml(res, 'book.html'));
app.get('/newsletter/:slug', (req, res) => sendHtml(res, 'newsletter-post.html'));
app.get('/discussion/:slug', (req, res) => sendHtml(res, 'thread.html'));
app.get('/mutual-aid/post/:id', (req, res) => sendHtml(res, 'aid-post.html'));

app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    },
  })
);

// 404
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`Local Lee listening on http://localhost:${PORT}`);
});
