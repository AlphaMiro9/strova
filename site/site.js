/* Strova website – OS detection, live release links, download wizard, scroll reveal */
(function () {
  // ── Reveal on scroll ──
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 })
    : null;
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 6) * 70 + 'ms';
    io ? io.observe(el) : el.classList.add('in');
  });

  // ── Which device is this? ──
  const ua = navigator.userAgent;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  let os = 'windows';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1)) os = 'ios';
  else if (/mac/i.test(platform)) os = 'mac';
  else if (/linux/i.test(platform)) os = 'linux';
  else if (/arm|aarch64/i.test(ua)) os = 'windows-arm';

  const OS = {
    windows: { name: 'Windows', sub: 'x64 · Installer', icon: '🪟' },
    'windows-arm': { name: 'Windows ARM', sub: 'Surface, Snapdragon', icon: '🪟' },
    mac: { name: 'macOS', sub: 'Apple Silicon & Intel', icon: '🍎' },
    linux: { name: 'Linux', sub: 'AppImage · .deb', icon: '🐧' },
    android: { name: 'Android', sub: 'APK', icon: '🤖' },
    ios: { name: 'iPhone & iPad', sub: 'Web-App', icon: '📱' },
  };
  const HOWTO = {
    windows: [
      ['Setup öffnen', 'Öffne die heruntergeladene Datei <b>Strova_…_setup.exe</b> (unten im Browser oder im Ordner „Downloads“).'],
      ['Windows-Hinweis bestätigen', 'Erscheint „Der Computer wurde durch Windows geschützt“: auf <b>Weitere Informationen</b> und dann <b>Trotzdem ausführen</b> klicken.'],
      ['Assistent folgen', 'Der Strova-Assistent führt dich durch die Installation: Lizenz, „Nur für mich“ oder „Für alle“, Zielordner.'],
      ['Los geht’s', 'Am Ende <b>Strova starten</b> anhaken – fertig. Strova findet sich auch im Startmenü.'],
    ],
    mac: [
      ['DMG öffnen', 'Öffne die Datei <b>Strova_…_universal.dmg</b>.'],
      ['In Programme ziehen', 'Ziehe Strova in den Ordner <b>Programme</b>.'],
      ['Erster Start', 'Beim ersten Start <b>Rechtsklick → Öffnen</b> wählen und bestätigen (die App ist nicht von Apple notarisiert).'],
    ],
    linux: [
      ['AppImage ausführbar machen', 'Rechtsklick → Eigenschaften → „Als Programm ausführen“ – oder <code>chmod +x Strova*.AppImage</code>.'],
      ['Starten', 'Doppelklick auf die Datei. Alternativ die <b>.deb</b> mit deinem Paketmanager installieren.'],
    ],
    android: [
      ['APK öffnen', 'Tippe in der Download-Benachrichtigung auf <b>Strova-android.apk</b>.'],
      ['Installation erlauben', 'Android fragt nach „Unbekannte Apps installieren“ – für deinen Browser <b>erlauben</b>.'],
      ['Installieren', 'Auf <b>Installieren</b> tippen und danach <b>Öffnen</b>.'],
    ],
    ios: [
      ['In Safari öffnen', 'Öffne die Web-App in <b>Safari</b> (der Link öffnet sich gleich).'],
      ['Teilen', 'Tippe unten auf das <b>Teilen-Symbol</b> (Quadrat mit Pfeil).'],
      ['Zum Home-Bildschirm', 'Wähle <b>Zum Home-Bildschirm</b> → <b>Hinzufügen</b>. Strova erscheint wie eine App.'],
    ],
  };
  HOWTO['windows-arm'] = HOWTO.windows;

  // ── Hero button + recommended card ──
  function highlight(osKey) {
    document.querySelectorAll('.dl').forEach(d => d.classList.toggle('recommended', d.dataset.os === osKey));
    const hero = document.getElementById('heroDownload');
    if (hero) hero.querySelector('span').textContent = osKey === 'ios' ? 'Für iPhone einrichten' : `Für ${OS[osKey].name} herunterladen`;
  }
  highlight(os);
  if (os === 'windows' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture']).then(v => { if (v.architecture === 'arm') { os = 'windows-arm'; highlight(os); } }).catch(() => {});
  }

  // ── Latest release: direct file links ──
  const links = {}; // os -> {url, name, size}
  document.querySelectorAll('.dl').forEach(card => { links[card.dataset.os] = { url: card.getAttribute('href'), name: '', size: 0 }; });
  fetch('https://api.github.com/repos/AlphaMiro9/strova/releases/latest')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(rel => {
      const assets = (rel.assets || []).filter(a => !/\.sig$|latest\.json$/.test(a.name));
      document.querySelectorAll('.dl[data-asset]').forEach(card => {
        let hit = null;
        for (const p of card.dataset.asset.split('|')) { hit = assets.find(a => a.name.endsWith(p) || a.name.includes(p)); if (hit) break; }
        if (hit) {
          card.href = hit.browser_download_url;
          links[card.dataset.os] = { url: hit.browser_download_url, name: hit.name, size: hit.size };
          card.querySelector('small').textContent += ` · ${Math.round(hit.size / 1048576)} MB`;
        }
      });
      const v = (rel.tag_name || '').replace(/^v/, '');
      document.querySelectorAll('[data-version]').forEach(e => { e.textContent = v; });
      document.getElementById('relInfo').textContent = `Version ${v} · veröffentlicht am ${new Date(rel.published_at).toLocaleDateString('de-DE')} · kostenlos, ohne Anmeldung.`;
    })
    .catch(() => {});

  // ── Download wizard ──
  const wiz = document.getElementById('wizard');
  let chosen = os, step = 1, lastFocus = null;

  function show(n) {
    step = n;
    wiz.querySelectorAll('.wiz-page').forEach(p => { p.hidden = +p.dataset.page !== n; });
    wiz.querySelectorAll('.wiz-steps li').forEach(li => {
      li.classList.toggle('on', +li.dataset.s === Math.min(n, 3));
      li.classList.toggle('done', +li.dataset.s < n);
    });
    const first = wiz.querySelector(`.wiz-page[data-page="${n}"] button, .wiz-page[data-page="${n}"] a`);
    if (first) first.focus({ preventScroll: true });
  }
  function renderOs() {
    document.getElementById('wizOs').innerHTML = Object.entries(OS).map(([k, o]) => `
      <button class="wiz-osbtn ${k === chosen ? 'sel' : ''}" data-os="${k}">
        <span class="i">${o.icon || ''}</span><b>${o.name}</b><small>${o.sub}</small>${k === os ? '<em>Dein Gerät</em>' : ''}
      </button>`).join('');
  }
  function startDownload() {
    const l = links[chosen] || {};
    const bar = wiz.querySelector('.wiz-bar i');
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    const manual = document.getElementById('wizManual');
    manual.href = l.url || 'https://github.com/AlphaMiro9/strova/releases/latest';
    if (chosen === 'ios') {
      document.getElementById('wizFile').textContent = 'Für iPhone brauchst du nichts herunterzuladen – Strova läuft als Web-App.';
      manual.textContent = 'Web-App jetzt öffnen'; manual.href = 'app/';
      return;
    }
    manual.textContent = 'Hier direkt herunterladen';
    const size = l.size ? ` · ${Math.round(l.size / 1048576)} MB` : '';
    document.getElementById('wizFile').innerHTML = l.name ? `<b>${l.name}</b>${size}` : 'Du wirst zur Download-Seite weitergeleitet.';
    // start the actual download (direct file) – or open the release page when no direct link is known yet
    if (l.name) { const a = document.createElement('a'); a.href = l.url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    else window.open(manual.href, '_blank', 'noopener');
  }
  function renderHowto() {
    document.getElementById('wizHowto').innerHTML = HOWTO[chosen].map(([t, d], i) =>
      `<li style="animation-delay:${i * 90}ms"><span class="n">${i + 1}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('');
  }
  function open(osKey) {
    lastFocus = document.activeElement;
    chosen = osKey || os;
    renderOs();
    wiz.hidden = false;
    document.body.classList.add('wiz-open');
    requestAnimationFrame(() => wiz.classList.add('show'));
    if (osKey) { show(2); startDownload(); } else show(1);
  }
  function close() {
    wiz.classList.remove('show');
    document.body.classList.remove('wiz-open');
    setTimeout(() => { wiz.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function confetti() {
    const box = wiz.querySelector('.wiz-box');
    const colors = ['#8b5cf6', '#f472b6', '#fb923c', '#34d399', '#facc15'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      c.style.animationDelay = Math.random() * .3 + 's';
      box.appendChild(c);
      setTimeout(() => c.remove(), 2200);
    }
  }

  wiz.addEventListener('click', (e) => {
    if (e.target === wiz) return close();
    const osBtn = e.target.closest('.wiz-osbtn');
    if (osBtn) { chosen = osBtn.dataset.os; renderOs(); show(2); startDownload(); return; }
    const a = e.target.closest('[data-wiz]'); if (!a) return;
    const act = a.dataset.wiz;
    if (act === 'close') close();
    if (act === 'back') show(Math.max(1, step - 1));
    if (act === 'next') { renderHowto(); show(3); if (chosen === 'ios') window.open('app/', '_blank', 'noopener'); }
    if (act === 'done') { show(4); confetti(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !wiz.hidden) close(); });

  document.getElementById('heroDownload').addEventListener('click', (e) => { e.preventDefault(); open(null); });
  document.querySelectorAll('.dl').forEach(card => card.addEventListener('click', (e) => { e.preventDefault(); open(card.dataset.os); }));
})();
