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
- [ ] Front the app with HTTPS (nginx + certbot) and set `NODE_ENV=production`
- [ ] Point DNS for the chosen domain at the droplet
- [ ] If the domain is not `locallee.org`, set `SITE_URL` accordingly and
      update the canonical hostnames inside the static HTML and `llms.txt`

## Deploying to the DigitalOcean droplet

`scripts/deploy.sh` is a one-shot deployer that runs **on the droplet itself**.
It is intentionally narrow: it only touches Local Lee resources
(`/opt/locallee`, the `locallee` system user, `locallee.service`,
`/etc/locallee.env`, and a single nginx site file named `locallee`). It
will refuse to overwrite any of those files if they exist and weren't
written by us, so it can't clobber Sauk Saver or Simple Solutions.

### First deploy

```bash
# On the droplet, as a user with sudo:
sudo git clone https://github.com/DeLanderDev/LL1.0.git /opt/locallee
cd /opt/locallee
sudo ./scripts/deploy.sh
```

That will:

1. Create the `locallee` system user (if missing).
2. Check out `main` (configurable via `DEPLOY_BRANCH`) and `npm ci` deps.
3. Generate `/etc/locallee.env` with a random `SESSION_SECRET` and
   `ADMIN_PASSWORD` (printed once on stdout — save them).
4. Write and start `locallee.service` (systemd, hardened, listening on
   **port 8082** by default).
5. Write `/etc/nginx/sites-available/locallee`. **It does not enable the
   site until you give it a domain** — see below.

### Updates

```bash
cd /opt/locallee
sudo ./scripts/deploy.sh
```

Idempotent. Pulls the branch, reinstalls deps, restarts the service.

### Wiring up nginx + HTTPS

Once you've decided on a hostname and pointed DNS at the droplet:

```bash
sudo DOMAIN=locallee.example.org /opt/locallee/scripts/deploy.sh
sudo certbot --nginx -d locallee.example.org
```

The first command symlinks the site into `sites-enabled` and reloads
nginx; the second issues a Let's Encrypt cert and rewrites the site for
HTTPS. Neither command touches any other site config on the box.

### Useful overrides

```bash
DEPLOY_BRANCH=claude/build-local-lee-website-VgrQW \
ADMIN_EMAIL=you@example.com \
SITE_URL=https://locallee.example.org \
DOMAIN=locallee.example.org \
sudo -E ./scripts/deploy.sh
```

### Logs and ops

```bash
sudo systemctl status locallee
sudo journalctl -u locallee -f          # tail logs
sudo systemctl restart locallee         # restart only Local Lee
```
