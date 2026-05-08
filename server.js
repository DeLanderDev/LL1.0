'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

// ----- Configuration -----
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

// ----- Schema -----
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

CREATE INDEX IF NOT EXISTS idx_business_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_aid_resources_status ON aid_resources(status);
CREATE INDEX IF NOT EXISTS idx_aid_posts_status ON aid_posts(status);
CREATE INDEX IF NOT EXISTS idx_aid_posts_expires ON aid_posts(expires_at);
`);

// ----- Seed admin + categories + a little curated content -----
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
        'Small Is Beautiful',
        'small-is-beautiful',
        'E. F. Schumacher',
        '1973',
        'A study of economics as if people mattered - appropriate scale, appropriate technology, durable work.',
        'Practical questions about what size of enterprise actually serves a place.',
      ],
      [
        'The Long-Legged House',
        'long-legged-house',
        'Wendell Berry',
        '1969',
        'Essays on staying put, on a particular Kentucky river, on the work of becoming native to a place.',
        'A primer on what it means to belong to a county.',
      ],
      [
        'Bowling Alone',
        'bowling-alone',
        'Robert D. Putnam',
        '2000',
        'A landmark account of the decline of civic and social life in American communities.',
        'Names what we have lost in clear terms - and where to start rebuilding.',
      ],
      [
        'The Death and Life of Great American Main Streets',
        'main-streets',
        'Various',
        '-',
        'A working anthology on small-town main streets, locally owned shops, and the economics of staying.',
        'Reading list for anyone thinking about Dixon, Amboy, or Ashton five years from now.',
      ],
    ];
    for (const b of seedBooks) insertBook.run(...b);
  }

  const aidCount = db
    .prepare("SELECT COUNT(*) AS n FROM aid_resources WHERE status = 'approved'")
    .get().n;
  if (aidCount === 0) {
    const insertAid = db.prepare(
      `INSERT INTO aid_resources (name, slug, category, description, town, status)
       VALUES (?, ?, ?, ?, ?, 'approved')`
    );
    const seeds = [
      ['Lee County Food Pantry Network', 'lee-county-food-pantries', 'Food', 'A directory entry for the food pantries serving Lee County. Contact your local pantry directly for hours and intake.', 'Dixon'],
      ['Warming Center (Winter)', 'warming-center', 'Shelter', 'Seasonal warming center information for cold-weather emergencies.', 'Dixon'],
      ['Diaper & Formula Bank', 'diaper-formula-bank', 'Family', 'Diapers, wipes, and formula for families in need.', 'Dixon'],
      ['Tool Library (Informal)', 'tool-library', 'Goods', 'Neighbors lending neighbors - borrow what you need to fix what is yours.', 'Amboy'],
      ['Ride Share Board', 'ride-share', 'Transportation', 'Posting board for rides to medical appointments, grocery runs, and church.', 'Lee County'],
    ];
    for (const r of seeds) insertAid.run(...r);
  }
}
seed();

// ----- App -----
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// 2 MB so admin logo uploads (sent as base64 data URLs) fit. Regular
// form posts are far smaller; the larger ceiling only matters when the
// request actually carries a big JSON payload.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Secure cookies require HTTPS, so they have to be driven independently
// from NODE_ENV - a production-mode app sitting behind plain HTTP (e.g.
// reachable directly on a droplet port before nginx + certbot are in
// place) can't set Secure cookies, or the browser silently drops them
// and nobody can stay logged in. Default off; flip on once HTTPS is up.
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

// ----- Helpers -----
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

// ----- Auth API -----
app.post('/api/register', (req, res) => {
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

// ----- Categories -----
app.get('/api/categories', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, slug, parent_id, sort_order FROM categories ORDER BY sort_order, name')
    .all();
  res.json({ categories: rows });
});

// ----- Business Directory -----
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

app.post('/api/businesses', (req, res) => {
  const name = trim(req.body.name, 120);
  if (!name) return res.status(400).json({ error: 'Business name required.' });
  const fields = {
    name,
    description: trim(req.body.description, 4000),
    category_id: parseInt(req.body.category_id, 10) || null,
    town: trim(req.body.town, 80),
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

app.post('/api/businesses/:id/claim', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const biz = db.prepare('SELECT id, claim_status FROM businesses WHERE id = ?').get(id);
  if (!biz) return res.status(404).json({ error: 'Not found.' });
  db.prepare(
    `UPDATE businesses SET claim_status = 'claim_pending', owner_user_id = ? WHERE id = ?`
  ).run(req.session.userId, id);
  res.json({ ok: true });
});

// ----- Events -----
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

app.post('/api/events', (req, res) => {
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

// ----- Literature -----
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

app.post('/api/books', (req, res) => {
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

app.post('/api/books/:id/comments', requireAuth, (req, res) => {
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

// ----- Mutual Aid: curated resources -----
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

app.post('/api/aid/resources', (req, res) => {
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

// ----- Mutual Aid: needs & offers -----
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

app.post('/api/aid/posts', (req, res) => {
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

// ----- Contact -----
app.post('/api/contact', (req, res) => {
  const name = trim(req.body.name, 120);
  const email = trim(req.body.email, 254);
  const message = trim(req.body.message, 4000);
  if (!name || !message) return res.status(400).json({ error: 'Name and message required.' });
  // Persist as an aid post in admin queue? No - log.
  console.log(`[contact] ${new Date().toISOString()} from=${name}<${email}>: ${message}`);
  res.json({ ok: true });
});

// ----- Admin -----
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

// Admin delete: hard-removes a row regardless of status. Cascades follow
// the FK definitions (event RSVPs, book comments, etc.).
app.post('/api/admin/:type/:id/delete', requireAdmin, (req, res) => {
  const table = APPROVABLE[req.params.type];
  if (!table) return res.status(400).json({ error: 'Unknown type.' });
  const id = parseInt(req.params.id, 10);
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});

// Delete a single book comment.
app.post('/api/admin/book-comment/:id/delete', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM book_comments WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Lists of approved content for the admin "Manage" view.
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

// ----- Brand mark (logo) -----
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

app.get('/brand-mark', (req, res) => {
  const meta = logoMeta();
  if (meta) {
    const filePath = path.join(UPLOAD_DIR, meta.file);
    if (fs.existsSync(filePath)) {
      res.set('Cache-Control', 'public, max-age=300');
      res.set('Content-Type', meta.mime);
      return fs.createReadStream(filePath).pipe(res);
    }
  }
  res.set('Cache-Control', 'public, max-age=86400');
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
  // Wipe any earlier logo files so we don't accumulate orphans.
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

// ----- Sitemap & robots & llms.txt (dynamic with current content) -----
app.get('/sitemap.xml', (req, res) => {
  const urls = [
    '/', '/about', '/contact', '/directory', '/events', '/literature', '/mutual-aid',
  ];
  const rows = [
    ...db.prepare("SELECT slug FROM businesses WHERE status='approved'").all().map(r => `/directory/${r.slug}`),
    ...db.prepare("SELECT slug FROM events WHERE status='approved'").all().map(r => `/events/${r.slug}`),
    ...db.prepare("SELECT slug FROM books WHERE status='approved'").all().map(r => `/literature/${r.slug}`),
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

// ----- Pretty routes for slug pages (serve static page; client JS fetches data) -----
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
};
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
}

app.get('/directory/:slug', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'business.html'))
);
app.get('/events/:slug', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'event.html'))
);
app.get('/literature/:slug', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'book.html'))
);
app.get('/mutual-aid/post/:id', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'aid-post.html'))
);

// ----- Static -----
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    maxAge: '1h',
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
