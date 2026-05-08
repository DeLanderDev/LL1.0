# Local Lee

A neighborly network for Lee County, Illinois — locally owned businesses,
community events, a reading list, and a mutual-aid board.

Built like the existing Sauk Saver / Simple Solutions stack:
**Node.js + Express + better-sqlite3 + bcrypt + sessions**, with a
static-HTML / vanilla-JS frontend and an admin dashboard for moderating
user submissions.

## Stack

- Node.js (>= 18)
- Express 4 + `express-session` + `connect-sqlite3`
- `better-sqlite3` for storage (file-based, single binary)
- `bcrypt` for password hashing
- Vanilla JS frontend, no build step at runtime

## Running locally

```bash
npm install
npm start
```

The server listens on **port 8082** by default (the same DigitalOcean droplet
hosts Sauk Saver on 8081 and Simple Solutions on a separate port).

Override via env vars if needed:

| Var                | Default                  | Notes                                   |
| ------------------ | ------------------------ | --------------------------------------- |
| `PORT`             | `8082`                   |                                         |
| `SITE_URL`         | `https://locallee.org`   | Used in canonical URLs / sitemap        |
| `ADMIN_EMAIL`      | `contact@locallee.org`   | Seeded admin login                      |
| `ADMIN_PASSWORD`   | `changeme`               | **Set this in production!**             |
| `SESSION_SECRET`   | random per-process       | Set this in production for stable sessions |
| `NODE_ENV`         | (unset)                  | When `production`, cookies are `secure` |

Visit:

- `http://localhost:8082/` — public site
- `http://localhost:8082/admin` — admin queue (sign in as the admin first)

## Layout

```
server.js              # all backend routes + DB schema + seeds
package.json
public/
  index.html           # home (hand-authored)
  about.html           # about (hand-authored)
  *.html               # other pages — generated from scripts/build-pages.js
  css/style.css
  js/main.js
  robots.txt
  llms.txt
scripts/
  build-pages.js       # regenerate static pages from a single shell template
data/                  # created at runtime; holds locallee.db + sessions.db
```

`sitemap.xml` is served dynamically by the server, including approved
businesses, events, and books.

## Editing pages

Hand-authored pages: `public/index.html`, `public/about.html`.

Other pages live in `scripts/build-pages.js`. After editing, run:

```bash
node scripts/build-pages.js
```

…to regenerate the static HTML files.

## Submission flow

Anyone can submit:

- **Businesses** (`/submit/business`)
- **Events** (`/submit/event`)
- **Books** (`/submit/book`)
- **Mutual-aid resources** (`/submit/aid-resource`)
- **Mutual-aid needs/offers** (`/submit/aid-post`)

All submissions enter `status = 'pending'` and are reviewed in `/admin`.
Mutual-aid needs/offers also auto-expire after 30 days (a background timer
moves them to `status = 'expired'`).

Business listings additionally support a "claim" flow — a registered user
can claim a listing, which moves it to `claim_status = 'claim_pending'`
for the admin to verify or deny.

## Security notes

- Passwords are hashed with bcrypt (cost 12).
- Sessions are stored server-side in SQLite (`connect-sqlite3`).
- All HTML user content is escaped client-side via `LL.escape`.
- SQL is parameterized.
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` headers set.
- The `/admin` page is gated server-side; it also has a `noindex` meta.

## Production checklist

- [ ] Set a real `ADMIN_PASSWORD` and rotate it after first sign-in
- [ ] Set a stable `SESSION_SECRET`
- [ ] Front the app with HTTPS (nginx/caddy) and set `NODE_ENV=production`
- [ ] Point DNS for the chosen domain at the droplet
- [ ] If the domain is not `locallee.org`, set `SITE_URL` accordingly and
      update the canonical hostnames inside the static HTML and `llms.txt`
