/* Strova website – OS detection, live release links, scroll reveal */
(function () {
  // Reveal on scroll
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 })
    : null;
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 6) * 70 + 'ms';
    io ? io.observe(el) : el.classList.add('in');
  });

  // Which device is this?
  const ua = navigator.userAgent;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  let os = 'windows';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1)) os = 'ios';
  else if (/mac/i.test(platform)) os = 'mac';
  else if (/linux/i.test(platform)) os = 'linux';
  else if (/arm|aarch64/i.test(ua)) os = 'windows-arm';
  const NAMES = { windows: 'Windows', 'windows-arm': 'Windows ARM', mac: 'macOS', linux: 'Linux', android: 'Android', ios: 'iPhone' };

  function highlight(osKey) {
    document.querySelectorAll('.dl').forEach(d => d.classList.toggle('recommended', d.dataset.os === osKey));
    const card = document.querySelector(`.dl[data-os="${osKey}"]`);
    const hero = document.getElementById('heroDownload');
    if (card && hero) {
      hero.href = card.href;
      hero.querySelector('span').textContent = osKey === 'ios' ? 'Für iPhone öffnen' : `Für ${NAMES[osKey]} herunterladen`;
    }
  }
  highlight(os);
  // Windows on ARM (Chromium tells us the real architecture)
  if (os === 'windows' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture']).then(v => { if (v.architecture === 'arm') { os = 'windows-arm'; highlight(os); } }).catch(() => {});
  }

  // Link straight to the files of the latest release
  fetch('https://api.github.com/repos/AlphaMiro9/strova/releases/latest')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(rel => {
      const assets = rel.assets || [];
      document.querySelectorAll('.dl[data-asset]').forEach(card => {
        const patterns = card.dataset.asset.split('|');
        let hit = null;
        for (const p of patterns) { hit = assets.find(a => a.name.endsWith(p) || a.name.includes(p)); if (hit) break; }
        if (hit) {
          card.href = hit.browser_download_url;
          const mb = Math.round(hit.size / 1048576);
          card.querySelector('small').textContent += ` · ${mb} MB`;
        }
      });
      const v = (rel.tag_name || '').replace(/^v/, '');
      document.querySelectorAll('[data-version]').forEach(e => { e.textContent = v; });
      document.getElementById('relInfo').textContent = `Version ${v} · veröffentlicht am ${new Date(rel.published_at).toLocaleDateString('de-DE')} · kostenlos, ohne Anmeldung.`;
      highlight(os);
    })
    .catch(() => { /* no release yet – cards link to the releases page */ });
})();
