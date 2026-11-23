/* Strova – update checker.
   Desktop app (Tauri): signed in-app updates – download, install, restart.
   Android app: shows the new version and links to the APK.
   Web app: always loads the newest files by itself (service worker, network first). */
(function () {
  const REPO = 'AlphaMiro9/strova';
  const tauri = window.__TAURI__;
  const isDesktop = !!(tauri && tauri.updater);
  const isAndroid = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android');
  const current = () => window.STROVA_VERSION || '0.0.0';

  const newer = (a, b) => { // a > b ?
    const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
    const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
    return false;
  };
  const toast = (t) => window.toast && window.toast(t);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** Release notes are Markdown – show them as simple, safe text lines. */
  const notesHtml = (md) => esc(String(md || '').slice(0, 1500))
    .replace(/^#+\s*(.*)$/gm, '<b>$1</b>').replace(/^\s*[-*]\s+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function dialog({ version, notes, primary, onPrimary, secondary = 'Später', onSecondary }) {
    document.querySelectorAll('.upd').forEach(e => e.remove());
    const el = document.createElement('div');
    el.className = 'upd';
    el.innerHTML = `
      <div class="upd-box" role="dialog" aria-modal="true" aria-labelledby="updTitle">
        <div class="upd-hero"><img src="icons/icon.svg" alt="" width="64" height="64"><span class="upd-spark">✨</span></div>
        <h2 id="updTitle">Update verfügbar</h2>
        <p class="upd-ver">Strova <b>${esc(version)}</b> · du hast ${esc(current())}</p>
        ${notes ? `<div class="upd-notes">${notesHtml(notes)}</div>` : ''}
        <div class="upd-progress" hidden><i></i></div>
        <p class="upd-status" hidden></p>
        <div class="upd-actions">
          <button class="btn" data-a="later">${esc(secondary)}</button>
          <button class="btn primary" data-a="go">${esc(primary)}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.querySelector('[data-a="later"]').addEventListener('click', () => { close(); onSecondary && onSecondary(); });
    el.querySelector('[data-a="go"]').addEventListener('click', () => onPrimary(el, close));
    setTimeout(() => el.querySelector('[data-a="go"]').focus(), 50);
    return el;
  }

  async function checkDesktop(manual) {
    let upd;
    try { upd = await tauri.updater.check(); }
    catch (e) { if (manual) toast('Update-Prüfung fehlgeschlagen: ' + (e.message || e)); return; }
    if (!upd) { if (manual) toast('✅ Strova ist auf dem neuesten Stand (' + current() + ')'); return; }
    if (!manual && localStorage.getItem('strova.update.skip') === upd.version) return;
    dialog({
      version: upd.version, notes: upd.body, primary: 'Jetzt aktualisieren',
      onSecondary: () => { try { localStorage.setItem('strova.update.skip', upd.version); } catch (e) {} },
      onPrimary: async (el) => {
        const bar = el.querySelector('.upd-progress'), fill = bar.querySelector('i'), status = el.querySelector('.upd-status');
        el.querySelectorAll('button').forEach(b => { b.disabled = true; });
        bar.hidden = false; status.hidden = false; status.textContent = 'Wird heruntergeladen …';
        let total = 0, got = 0;
        try {
          await upd.downloadAndInstall((ev) => {
            if (ev.event === 'Started') total = ev.data.contentLength || 0;
            else if (ev.event === 'Progress') {
              got += ev.data.chunkLength || 0;
              const p = total ? Math.min(100, (got / total) * 100) : 50;
              fill.style.width = p + '%';
              status.textContent = total ? `Wird heruntergeladen … ${Math.round(p)} %` : 'Wird heruntergeladen …';
            } else if (ev.event === 'Finished') { fill.style.width = '100%'; status.textContent = 'Wird installiert …'; }
          });
          status.textContent = 'Fertig! Strova startet neu …';
          setTimeout(() => tauri.process && tauri.process.relaunch(), 900);
        } catch (e) {
          status.textContent = 'Update fehlgeschlagen: ' + (e.message || e);
          el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        }
      },
    });
  }

  async function checkRelease(manual) {
    let rel;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      rel = await r.json();
    } catch (e) { if (manual) toast('Update-Prüfung fehlgeschlagen'); return; }
    const v = (rel.tag_name || '').replace(/^v/, '');
    if (!newer(v, current())) { if (manual) toast('✅ Strova ist auf dem neuesten Stand (' + current() + ')'); return; }
    if (!manual && localStorage.getItem('strova.update.skip') === v) return;
    const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
    const url = isAndroid && apk ? apk.browser_download_url : rel.html_url;
    dialog({
      version: v, notes: rel.body, primary: isAndroid ? 'APK herunterladen' : 'Zum Download',
      onSecondary: () => { try { localStorage.setItem('strova.update.skip', v); } catch (e) {} },
      onPrimary: (el, close) => { window.open(url, '_blank', 'noopener'); close(); },
    });
  }

  async function check(manual = false) {
    if (isDesktop) return checkDesktop(manual);
    if (isAndroid || manual) return checkRelease(manual);
    // plain web app: it updates itself – nothing to do
  }

  // Automatic check shortly after start, at most every 6 hours
  setTimeout(() => {
    let last = 0;
    try { last = +localStorage.getItem('strova.update.last') || 0; } catch (e) {}
    if (Date.now() - last < 6 * 3600 * 1000) return;
    try { localStorage.setItem('strova.update.last', String(Date.now())); } catch (e) {}
    check(false);
  }, 4000);

  window.StrovaUpdate = { check, isDesktop, isAndroid, newer };
})();
