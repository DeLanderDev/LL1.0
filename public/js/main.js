// Local Lee — shared client-side helpers and auth wiring.
(function () {
  'use strict';

  const LL = (window.LL = window.LL || {});

  LL.escape = function (s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  LL.formatDate = function (sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  LL.formatDay = function (sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  LL.daysUntil = function (sec) {
    if (!sec) return null;
    const ms = sec * 1000 - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  LL.api = async function (url, opts) {
    const o = Object.assign(
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      },
      opts || {}
    );
    if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
    const res = await fetch(url, o);
    let data = null;
    try { data = await res.json(); } catch (_) { /* not JSON */ }
    if (!res.ok) {
      const err = (data && data.error) || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data;
  };

  LL.notice = function (target, msg, kind) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.className = 'notice' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    el.hidden = !msg;
  };

  LL.markCurrent = function () {
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('nav.primary a[href]').forEach((a) => {
      const href = a.getAttribute('href').replace(/\/$/, '') || '/';
      if (href === path || (href !== '/' && path.startsWith(href))) {
        a.setAttribute('aria-current', 'page');
      }
    });
  };

  LL.refreshAccountNav = async function () {
    const slot = document.getElementById('nav-account');
    if (!slot) return;
    try {
      const { user } = await LL.api('/api/me');
      if (user) {
        const name = user.display_name || user.email;
        const adminLink =
          user.role === 'admin'
            ? ' <a href="/admin">Admin</a>'
            : '';
        slot.innerHTML =
          `<span class="who">Hi, ${LL.escape(name)}.</span>` +
          adminLink +
          ' <button type="button" class="btn btn-secondary" id="btn-logout">Sign out</button>';
        document.getElementById('btn-logout').addEventListener('click', async () => {
          await LL.api('/api/logout', { method: 'POST' });
          location.reload();
        });
      } else {
        slot.innerHTML =
          '<a href="/login">Sign in</a> · <a href="/register">Join</a>';
      }
    } catch (_) {
      slot.innerHTML = '<a href="/login">Sign in</a>';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    LL.markCurrent();
    LL.refreshAccountNav();
  });
})();
