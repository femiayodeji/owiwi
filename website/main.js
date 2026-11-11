// Owiwi website. Small, vanilla, no dependencies.

// The ONLY place the download URL lives. Every element with [data-apk] links here.
const APK_URL = 'https://github.com/femiayodeji/owiwi/releases/latest/download/owiwi.apk';

document.documentElement.classList.remove('no-js');

// Download links
for (const a of document.querySelectorAll('[data-apk]')) {
  a.href = APK_URL;
  a.setAttribute('download', 'owiwi.apk');
}

// Platform hint near the main button
(function platformNote() {
  const note = document.getElementById('platform-note');
  if (!note) return;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isAndroid) return;
  if (isIOS) {
    note.textContent = 'Android only for now. This won\'t install on iPhone or iPad.';
  } else {
    note.textContent = 'On a computer? Open this page on your Android phone.';
  }
  note.hidden = false;
})();

// Header border once the page scrolls
(function header() {
  const el = document.querySelector('.site-header');
  if (!el) return;
  const update = () => el.classList.toggle('scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
})();

// Provider tabs (WAI-ARIA tabs pattern, automatic activation)
(function tabs() {
  const list = document.querySelector('[role="tablist"]');
  if (!list) return;
  const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  function select(tab, focus) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = panelOf(t);
      if (p) p.hidden = !on;
    }
    if (focus) tab.focus();
  }

  const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
  select(initial, false);

  list.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) select(tab, false);
  });

  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      select(next, true);
    }
  });
})();

// Copy buttons
(function copyButtons() {
  const live = document.getElementById('live');

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    const ok = await copy(text);
    btn.textContent = ok ? 'Copied' : 'Press and hold to copy';
    btn.classList.toggle('copied', ok);
    if (live) live.textContent = ok ? `Copied ${text}` : 'Copy failed. Select the model ID and copy it manually.';
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
})();

// Footer year
const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
