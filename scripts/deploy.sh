#!/usr/bin/env bash
# deploy.sh — Local Lee one-shot droplet deployment.
#
# Run this on the DigitalOcean droplet itself, from inside a checkout of
# the repo. It is intentionally narrow in scope: it touches only Local Lee
# resources and never modifies anything that could belong to Sauk Saver,
# Simple Solutions, or any other app on the box.
#
# Usage (first time):
#   sudo git clone https://github.com/DeLanderDev/LL1.0.git /opt/locallee
#   cd /opt/locallee
#   sudo ./scripts/deploy.sh
#
# Usage (subsequent updates):
#   cd /opt/locallee
#   sudo ./scripts/deploy.sh
#
# Optional environment variables:
#   DEPLOY_BRANCH    Branch to deploy (default: main)
#   APP_DIR          Install location (default: /opt/locallee)
#   APP_USER         System user the service runs as (default: locallee)
#   APP_PORT         Port the service listens on (default: 8082)
#   ADMIN_EMAIL      Seeded admin email (default: contact@locallee.org)
#   ADMIN_PASSWORD   Seeded admin password (default: random; printed once)
#   SITE_URL         Public origin (default: https://locallee.org)
#   DOMAIN           If set, enables the nginx site for this hostname
#                    (the script writes the nginx config either way; it
#                    only symlinks it into sites-enabled when DOMAIN is set)

set -euo pipefail

# --------------------------------------------------------------- defaults
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/locallee}"
APP_USER="${APP_USER:-locallee}"
APP_PORT="${APP_PORT:-8082}"
ADMIN_EMAIL="${ADMIN_EMAIL:-contact@locallee.org}"
SITE_URL="${SITE_URL:-https://locallee.org}"
DOMAIN="${DOMAIN:-}"

SERVICE_NAME="locallee"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="/etc/${SERVICE_NAME}.env"
NGINX_AVAIL="/etc/nginx/sites-available/${SERVICE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SERVICE_NAME}"

# --------------------------------------------------------------- helpers
log() { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "This script needs root (try: sudo $0)."
  fi
}

# --------------------------------------------------------------- preflight
require_root

[[ -f "${PWD}/server.js" && -f "${PWD}/package.json" ]] \
  || die "Run this from the Local Lee repo root (where server.js lives). Got: ${PWD}"

# Verify nothing on the box already owns port 8082 (other than us).
if command -v ss >/dev/null && ss -ltnp "sport = :${APP_PORT}" 2>/dev/null | grep -q LISTEN; then
  if ! ss -ltnp "sport = :${APP_PORT}" 2>/dev/null | grep -q "${SERVICE_NAME}"; then
    if ! systemctl is-active --quiet "${SERVICE_NAME}.service"; then
      die "Port ${APP_PORT} is already in use by something other than ${SERVICE_NAME}. Refusing to deploy."
    fi
  fi
fi

# Sanity check we're not about to clobber another app's resources.
for f in "${SERVICE_FILE}" "${ENV_FILE}" "${NGINX_AVAIL}"; do
  if [[ -f "$f" ]] && ! grep -q "Local Lee" "$f" 2>/dev/null; then
    die "${f} exists and isn't ours. Aborting so we don't overwrite another app."
  fi
done

# Node check (we deliberately do NOT install Node — your other apps
# already depend on whatever's there, and we won't touch it).
command -v node >/dev/null || die "Node.js not found on PATH. Install it (NodeSource or n) before re-running."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "${NODE_MAJOR}" -ge 18 ]] || die "Node.js >= 18 required (found $(node -v))."
NODE_BIN="$(command -v node)"

# --------------------------------------------------------------- system user
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  log "Creating system user ${APP_USER}…"
  useradd --system --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

# --------------------------------------------------------------- code
log "Updating code in ${APP_DIR} (branch: ${DEPLOY_BRANCH})…"
# safe.directory='*' keeps git from complaining when /opt/locallee is owned
# by ${APP_USER} but the script (and therefore git) runs as root.
GIT="git -c safe.directory=* -C ${APP_DIR}"
${GIT} fetch --all --prune --quiet
# Make sure the requested branch exists on origin before we destroy local state.
if ! ${GIT} rev-parse --verify --quiet "origin/${DEPLOY_BRANCH}" >/dev/null; then
  die "Branch '${DEPLOY_BRANCH}' not found on origin. Set DEPLOY_BRANCH=<branch> or merge your PR first."
fi
# Make sure we end up on the requested branch even if HEAD is detached.
${GIT} checkout -q "${DEPLOY_BRANCH}"
${GIT} reset --hard "origin/${DEPLOY_BRANCH}" --quiet

# Sanity: the branch we just checked out actually contains the app.
if [[ ! -f "${APP_DIR}/server.js" || ! -f "${APP_DIR}/package.json" ]]; then
  die "Branch '${DEPLOY_BRANCH}' does not contain server.js / package.json. Pick a different DEPLOY_BRANCH."
fi

mkdir -p "${APP_DIR}/data"
# The app user needs to own the working tree so npm can write node_modules
# and the .npm cache. We re-chown on every deploy in case git pulled in
# new files as root.
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

log "Installing dependencies…"
# Use a clean install so repeated deploys don't drift.
sudo -u "${APP_USER}" -H bash -lc "cd '${APP_DIR}' && npm ci --omit=dev --no-audit --no-fund"

# --------------------------------------------------------------- env file
if [[ ! -f "${ENV_FILE}" ]]; then
  log "Generating ${ENV_FILE} (first deploy)…"
  SESSION_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -d '\n=')"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 2>/dev/null | tr -d '/+=')}"
  umask 077
  cat > "${ENV_FILE}" <<EOF
# Local Lee — production environment. Mode 600. Do not commit.
NODE_ENV=production
PORT=${APP_PORT}
SITE_URL=${SITE_URL}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
  chown root:"${APP_USER}" "${ENV_FILE}"
  chmod 640 "${ENV_FILE}"
  echo
  echo "    First-run admin credentials:"
  echo "      email:    ${ADMIN_EMAIL}"
  echo "      password: ${ADMIN_PASSWORD}"
  echo "    (Saved in ${ENV_FILE}. Change on first sign-in.)"
  echo
else
  log "Reusing existing ${ENV_FILE}."
fi

# --------------------------------------------------------------- systemd unit
log "Writing systemd unit…"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
# Local Lee — community site for Lee County, Illinois.
Description=Local Lee — Lee County, IL community site
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

# Hardening — service is fully isolated from the rest of the box.
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
ReadWritePaths=${APP_DIR}/data
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service" >/dev/null
log "Restarting ${SERVICE_NAME}…"
systemctl restart "${SERVICE_NAME}.service"

# Wait briefly for the port to come up.
for i in 1 2 3 4 5 6 7 8 9 10; do
  if ss -ltn "sport = :${APP_PORT}" 2>/dev/null | grep -q LISTEN; then
    break
  fi
  sleep 1
done

if ! ss -ltn "sport = :${APP_PORT}" 2>/dev/null | grep -q LISTEN; then
  warn "Service didn't start listening on :${APP_PORT}. Tail logs with:"
  warn "  journalctl -u ${SERVICE_NAME} -n 80 --no-pager"
  exit 1
fi
log "Service is listening on 127.0.0.1:${APP_PORT}."

# --------------------------------------------------------------- nginx site
if command -v nginx >/dev/null; then
  log "Writing nginx site to ${NGINX_AVAIL}…"
  SERVER_NAME_LINE="server_name ${DOMAIN:-_};"
  cat > "${NGINX_AVAIL}" <<EOF
# Local Lee — proxies a domain to the Node service on 127.0.0.1:${APP_PORT}.
# Lives at ${NGINX_AVAIL}; symlink into sites-enabled to activate.
# Pair with certbot for HTTPS (see deploy notes).

server {
    listen 80;
    listen [::]:80;
    ${SERVER_NAME_LINE}

    access_log /var/log/nginx/${SERVICE_NAME}.access.log;
    error_log  /var/log/nginx/${SERVICE_NAME}.error.log;

    # Reasonably small limit — no uploads, just JSON forms.
    client_max_body_size 256k;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }
}
EOF

  if [[ -n "${DOMAIN}" ]]; then
    if [[ ! -L "${NGINX_ENABLED}" ]]; then
      log "Enabling nginx site for ${DOMAIN}…"
      ln -sf "${NGINX_AVAIL}" "${NGINX_ENABLED}"
    fi
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx
      log "nginx reloaded. Now point DNS for ${DOMAIN} at this droplet, then run:"
      log "  certbot --nginx -d ${DOMAIN}"
    else
      warn "nginx config test failed; not reloading. Run 'nginx -t' to investigate."
    fi
  else
    warn "DOMAIN not set — nginx config written but not enabled."
    warn "When you have the domain, run: sudo DOMAIN=locallee.example ${APP_DIR}/scripts/deploy.sh"
  fi
else
  warn "nginx not installed; skipped writing site file."
fi

# --------------------------------------------------------------- summary
echo
log "Deploy complete."
log "  app dir:    ${APP_DIR}"
log "  service:    ${SERVICE_NAME}.service  (status: $(systemctl is-active ${SERVICE_NAME}.service))"
log "  port:       ${APP_PORT}"
log "  env file:   ${ENV_FILE}"
log "  nginx site: ${NGINX_AVAIL}$([[ -L "${NGINX_ENABLED}" ]] && echo ' (enabled)' || echo ' (not enabled)')"
log "  logs:       journalctl -u ${SERVICE_NAME} -f"
