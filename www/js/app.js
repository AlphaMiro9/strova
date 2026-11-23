/* Strova – app shell, router and pages */
(function () {
  const view = document.getElementById('view');
  const fmt = StrovaPlayer.fmt;
  let player = null;
  let routeToken = 0;

  // ───────── Emotions ─────────
  const REACTIONS = [
    { e: '😍', name: 'Liebe ich' },
    { e: '😂', name: 'Lustig' },
    { e: '🤯', name: 'Krass' },
    { e: '🥹', name: 'Berührend' },
    { e: '😴', name: 'Langweilig' },
    { e: '🔥', name: 'Hype' },
  ];
  const MOODS = [
    { key: 'lachen', emo: '😂', name: 'Lachen', hint: 'Comedy & Fails', q: 'lustige videos comedy', bg: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
    { key: 'chill', emo: '🌙', name: 'Chillen', hint: 'Lofi & Ruhe', q: 'lofi chill music', bg: 'linear-gradient(135deg,#6366f1,#0ea5e9)' },
    { key: 'energie', emo: '⚡', name: 'Energie', hint: 'Workout & Beats', q: 'workout motivation music', bg: 'linear-gradient(135deg,#f43f5e,#a855f7)' },
    { key: 'staunen', emo: '🤯', name: 'Staunen', hint: 'Wissen & Natur', q: 'wissenschaft doku erklärt', bg: 'linear-gradient(135deg,#10b981,#0891b2)' },
    { key: 'gaming', emo: '🎮', name: 'Zocken', hint: 'Let\'s Plays', q: 'gaming highlights deutsch', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
    { key: 'kochen', emo: '🍜', name: 'Hunger', hint: 'Rezepte', q: 'einfache rezepte kochen', bg: 'linear-gradient(135deg,#fb923c,#facc15)' },
    { key: 'gefuehl', emo: '🥹', name: 'Gefühle', hint: 'Berührende Momente', q: 'heartwarming moments', bg: 'linear-gradient(135deg,#ec4899,#f97316)' },
    { key: 'lernen', emo: '🧠', name: 'Lernen', hint: 'Tutorials', q: 'tutorial deutsch lernen', bg: 'linear-gradient(135deg,#0ea5e9,#22c55e)' },
  ];

  // ───────── Helpers ─────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => {
    if (n == null || n < 0) return '';
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',').replace(',0', '') + ' Mrd.';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' Mio.';
    if (n >= 1e3) return Math.round(n / 1e3) + ' Tsd.';
    return String(n);
  };
  const ago = (ms) => {
    if (!ms) return '';
    const s = (Date.now() - ms) / 1000;
    const u = [[31536000, 'Jahr', 'Jahren'], [2592000, 'Monat', 'Monaten'], [604800, 'Woche', 'Wochen'], [86400, 'Tag', 'Tagen'], [3600, 'Stunde', 'Stunden'], [60, 'Minute', 'Minuten']];
    for (const [sec, one, many] of u) { const v = Math.floor(s / sec); if (v >= 1) return `vor ${v} ${v === 1 ? one : many}`; }
    return 'gerade eben';
  };
  const germanDate = (s) => {
    if (!s) return '';
    return s.replace(/(\d+) (second|minute|hour|day|week|month|year)s? ago/, (_, n, u) => {
      const map = { second: ['Sekunde', 'Sekunden'], minute: ['Minute', 'Minuten'], hour: ['Stunde', 'Stunden'], day: ['Tag', 'Tagen'], week: ['Woche', 'Wochen'], month: ['Monat', 'Monaten'], year: ['Jahr', 'Jahren'] }[u];
      return `vor ${n} ${+n === 1 ? map[0] : map[1]}`;
    }).replace('Streamed ', 'Gestreamt ');
  };

  function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  window.toast = toast;

  function burst(x, y, emoji) {
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'burst'; s.textContent = emoji;
      const a = (Math.PI * 2 * i) / 9 + Math.random() * .4;
      const d = 50 + Math.random() * 50;
      s.style.left = x - 12 + 'px'; s.style.top = y - 14 + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
      s.style.setProperty('--rot', (Math.random() * 80 - 40) + 'deg');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function setView(html, cls) {
    view.className = cls || '';
    view.innerHTML = html;
    void view.offsetWidth;
    view.classList.add('view-enter');
    window.scrollTo(0, 0);
  }

  function emptyState(emoji, title, text, action) {
    return `<div class="empty"><div class="big">${emoji}</div><b>${esc(title)}</b><span>${esc(text)}</span>${action || ''}</div>`;
  }
  function errorState(err, retry) {
    let msg = err && err.name === 'AbortError' ? 'Zeitüberschreitung' : (err && err.message) || 'Unbekannter Fehler';
    if (/could not get any stream/i.test(msg)) msg = 'Dieses Video (z. B. ein Livestream) liefert die Instanz gerade nicht.';
    return emptyState('🛰️', 'Keine Verbindung zur Instanz', msg + ' – probiere es erneut oder wähle in den Einstellungen eine andere Quelle oder Instanz.',
      `<button class="btn primary" data-retry>Erneut versuchen</button>`);
  }
  function bindRetry(fn) { const b = view.querySelector('[data-retry]'); if (b) b.addEventListener('click', fn); }

  function skeletonGrid(n = 12) {
    return '<div class="grid">' + Array.from({ length: n }, () =>
      `<div class="card sk-card"><div class="thumb skeleton"></div><div class="meta"><div class="avatar skeleton"></div><div style="flex:1"><div class="skeleton sk-line" style="width:90%"></div><div class="skeleton sk-line" style="width:60%"></div></div></div></div>`).join('') + '</div>';
  }

  function videoCard(v, i = 0) {
    const pos = Store.position(v.id);
    const pct = pos && pos.d ? Math.min(100, (pos.t / pos.d) * 100) : 0;
    const react = Store.reactionOf(v.id);
    const dur = v.live ? '<span class="duration live">LIVE</span>' : (v.duration > 0 ? `<span class="duration">${fmt(v.duration)}</span>` : '');
    const subline = [v.views >= 0 && v.views != null ? num(v.views) + ' Aufrufe' : '', germanDate(v.uploadedDate) || (v.at ? ago(v.at) : '')].filter(Boolean).join(' · ');
    return `<article class="card" style="animation-delay:${Math.min(i, 16) * 30}ms">
      <a class="thumb" href="#/watch/${esc(v.id)}" aria-label="${esc(v.title)}">
        <img src="${esc(v.thumbnail)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        ${react ? `<span class="react-badge">${react}</span>` : ''}${dur}
        ${pct ? `<span class="progress-bar"><i style="width:${pct}%"></i></span>` : ''}
      </a>
      <div class="meta">
        ${v.uploaderAvatar ? `<a href="#/channel/${esc(v.uploaderUrl)}"><img class="avatar" src="${esc(v.uploaderAvatar)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a>` : ''}
        <div class="meta-text">
          <a href="#/watch/${esc(v.id)}" class="title">${esc(v.title)}</a>
          <div class="sub">${v.uploaderUrl ? `<a href="#/channel/${esc(v.uploaderUrl)}">${esc(v.uploaderName)}</a>` : esc(v.uploaderName)}${v.verified ? ' ✓' : ''}</div>
          ${subline ? `<div class="sub">${esc(subline)}</div>` : ''}
        </div>
      </div>
    </article>`;
  }
  function channelCard(c, i = 0) {
    return `<a class="channel-card" href="#/channel/${esc(c.id)}" style="animation-delay:${i * 30}ms">
      <img src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div><b>${esc(c.name)}${c.verified ? ' ✓' : ''}</b><div class="sub">${c.subscribers > 0 ? num(c.subscribers) + ' Abonnenten' : ''}${c.videos > 0 ? ' · ' + c.videos + ' Videos' : ''}</div></div>
    </a>`;
  }
  const grid = (items, offset = 0) => items.map((it, i) => it.type === 'channel' ? channelCard(it, i) : videoCard(it, i + offset)).join('');

  // ───────── Pages ─────────
  async function pageHome(token) {
    const s = Store.settings();
    const chips = MOODS.map(m => `<a class="chip" href="#/mood/${m.key}">${m.emo} ${m.name}</a>`).join('');
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : hour < 22 ? 'Guten Abend' : 'Gute Nacht';
    const cont = Store.history().filter(h => Store.position(h.id)).slice(0, 4);
    setView(`
      <h1 class="page-title">${greet} 👋</h1>
      <p class="page-sub">Worauf hast du Lust? Wähle eine Stimmung oder schau, was gerade angesagt ist.</p>
      <div class="chips">${chips}</div>
      ${cont.length ? `<div class="section"><h2>Weiterschauen</h2></div><div class="grid">${grid(cont)}</div>` : ''}
      <div class="section"><h2>Trends in ${esc(regionName(s.region))}</h2></div>
      <div id="trending">${skeletonGrid()}</div>`);
    try {
      const items = await Piped.trending(s.region);
      if (token !== routeToken) return;
      document.getElementById('trending').innerHTML = items.length ? `<div class="grid">${grid(items)}</div>` : emptyState('🌵', 'Keine Trends', 'Diese Instanz liefert gerade nichts.');
    } catch (err) {
      if (token !== routeToken) return;
      document.getElementById('trending').innerHTML = errorState(err);
      bindRetry(() => route());
    }
  }

  function pageMoods() {
    const reactions = Object.values(Store.reactions());
    const counts = REACTIONS.map(r => ({ ...r, n: reactions.filter(x => x.emoji === r.e).length }));
    setView(`
      <h1 class="page-title">Stimmungen</h1>
      <p class="page-sub">Videos passend zu deinem Gefühl – und alles, worauf du reagiert hast.</p>
      <div class="mood-grid">${MOODS.map((m, i) => `
        <a class="mood" href="#/mood/${m.key}" style="background:${m.bg};animation-delay:${i * 40}ms">
          <span class="emo">${m.emo}</span><b>${m.name}</b><small>${m.hint}</small>
        </a>`).join('')}</div>
      <div class="section"><h2>Deine Reaktionen</h2></div>
      ${reactions.length ? `<div class="chips">${counts.map(c => `<a class="chip" href="#/library/reactions/${encodeURIComponent(c.e)}">${c.e} ${esc(c.name)} · ${c.n}</a>`).join('')}</div>
        <div class="grid" style="margin-top:12px">${grid(reactions.sort((a, b) => b.at - a.at).slice(0, 8))}</div>`
        : emptyState('💫', 'Noch keine Reaktionen', 'Reagiere unter einem Video mit einem Emoji – es landet hier.')}`);
  }

  async function pageMood(key, token) {
    const m = MOODS.find(x => x.key === key);
    if (!m) return pageMoods();
    setView(`
      <div class="mood" style="background:${m.bg};height:150px;margin-bottom:22px;cursor:default;transform:none"><span class="emo" style="font-size:80px">${m.emo}</span><b style="font-size:28px">${m.name}</b><small>${m.hint}</small></div>
      <div id="list">${skeletonGrid()}</div>`);
    await loadSearchInto(m.q, 'videos', token);
  }

  async function loadSearchInto(q, filter, token) {
    const list = document.getElementById('list');
    let next = null, offset = 0;
    async function load(more) {
      try {
        const r = await Piped.search(q, filter, more ? next : undefined);
        if (token !== routeToken) return;
        next = r.nextpage;
        const html = grid(r.items, offset);
        offset += r.items.length;
        if (!more) list.innerHTML = r.items.length ? `<div class="grid">${html}</div>` : emptyState('🔍', 'Nichts gefunden', 'Versuche einen anderen Suchbegriff.');
        else list.querySelector('.grid').insertAdjacentHTML('beforeend', html);
        let moreBox = list.querySelector('.more');
        if (moreBox) moreBox.remove();
        if (next && r.items.length) {
          list.insertAdjacentHTML('beforeend', '<div class="more"><button class="btn">Mehr laden</button></div>');
          const b = list.querySelector('.more button');
          b.addEventListener('click', () => { b.disabled = true; b.textContent = 'Lädt …'; load(true); });
          observeMore(b);
        }
      } catch (err) {
        if (token !== routeToken) return;
        if (!more) { list.innerHTML = errorState(err); bindRetry(() => { list.innerHTML = skeletonGrid(); load(false); }); }
        else toast('Konnte nicht mehr laden');
      }
    }
    await load(false);
  }
  function observeMore(btn) {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && !btn.disabled) { io.disconnect(); btn.click(); }
    }, { rootMargin: '600px' });
    io.observe(btn);
  }

  async function pageSearch(q, filter, token) {
    filter = filter || 'all';
    const tabs = [['all', 'Alles'], ['videos', 'Videos'], ['channels', 'Kanäle'], ['music_songs', 'Musik']];
    setView(`
      <h1 class="page-title">„${esc(q)}“</h1>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${k === filter ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      <div id="list">${skeletonGrid()}</div>`);
    view.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      location.hash = `#/search?q=${encodeURIComponent(q)}&f=${b.dataset.f}`;
    });
    document.getElementById('searchInput').value = q;
    await loadSearchInto(q, filter, token);
  }

  async function pageWatch(id, token, startAt) {
    setView(`<div class="watch">
      <div><div id="playerHost"><div class="player skeleton"></div></div><div class="watch-info" id="info"><div class="skeleton sk-line" style="height:24px;width:70%;margin-top:18px"></div><div class="skeleton sk-line" style="width:40%"></div></div></div>
      <aside class="related" id="related">${Array.from({ length: 6 }, () => '<div class="card sk-card"><div class="thumb skeleton"></div></div>').join('')}</aside>
    </div>`, 'watch-mode');
    let d;
    try {
      d = await Piped.streams(id);
    } catch (err) {
      if (token !== routeToken) return;
      document.getElementById('playerHost').innerHTML = '';
      document.getElementById('info').innerHTML = errorState(err);
      document.getElementById('related').innerHTML = '';
      bindRetry(() => route());
      return;
    }
    if (token !== routeToken) return;
    document.title = d.title + ' · Strova';
    Store.addHistory(d);

    const host = document.getElementById('playerHost');
    host.innerHTML = '';
    const pos = Store.settings().resume ? Store.position(id) : null;
    const nextVideo = d.related[0];
    player = StrovaPlayer.create(host, {
      data: d,
      startAt: startAt != null ? startAt : (pos ? pos.t : 0),
      autoplay: true,
      onEnded: (force) => {
        if (nextVideo && (force || Store.settings().autoplayNext)) {
          toast('Als Nächstes: ' + nextVideo.title);
          location.hash = '#/watch/' + nextVideo.id;
        }
      },
    });
    if (pos && startAt == null) toast('Weiter bei ' + fmt(pos.t));

    const subbed = Store.isSubbed(d.uploaderUrl);
    const saved = Store.isSaved(id);
    const current = Store.reactionOf(id);
    const info = document.getElementById('info');
    info.innerHTML = `
      <h1 class="watch-title">${esc(d.title)}</h1>
      <div class="watch-bar">
        <div class="uploader">
          <a href="#/channel/${esc(d.uploaderUrl)}"><img class="avatar" src="${esc(d.uploaderAvatar)}" alt="" referrerpolicy="no-referrer"></a>
          <div><a href="#/channel/${esc(d.uploaderUrl)}"><b>${esc(d.uploaderName)}${d.verified ? ' ✓' : ''}</b></a><span class="sub">${d.subscribers > 0 ? num(d.subscribers) + ' Abonnenten' : ''}</span></div>
          <button class="btn ${subbed ? '' : 'primary'}" id="subBtn">${subbed ? 'Abonniert ✓' : 'Abonnieren'}</button>
        </div>
        <div class="actions">
          <div class="reactions" role="group" aria-label="Wie fühlt sich das Video an?">
            ${REACTIONS.map(r => `<button class="reaction ${current === r.e ? 'on' : ''}" data-e="${r.e}" title="${esc(r.name)}" aria-label="${esc(r.name)}" aria-pressed="${current === r.e}">${r.e}</button>`).join('')}
          </div>
          <button class="btn" id="saveBtn">${saved ? '🔖 Gespeichert' : '🔖 Später'}</button>
          <button class="btn" id="shareBtn">↗ Teilen</button>
          <button class="btn" id="hideBtn" title="Videos dieses Kanals nicht mehr anzeigen">🚫 Kanal ausblenden</button>
        </div>
      </div>
      <div class="desc" id="desc"><b>${d.views >= 0 ? num(d.views) + ' Aufrufe' : ''}${d.uploadDate ? ' · ' + new Date(d.uploadDate).toLocaleDateString('de-DE') : ''}${d.likes > 0 ? ' · 👍 ' + num(d.likes) : ''}</b>\n${sanitizeDesc(d.description)}</div>`;

    info.querySelector('#subBtn').addEventListener('click', (e) => {
      const on = Store.toggleSub({ id: d.uploaderUrl, name: d.uploaderName, avatar: d.uploaderAvatar });
      e.currentTarget.textContent = on ? 'Abonniert ✓' : 'Abonnieren';
      e.currentTarget.classList.toggle('primary', !on);
      toast(on ? `${d.uploaderName} abonniert` : 'Abo entfernt');
    });
    info.querySelector('#saveBtn').addEventListener('click', (e) => {
      const on = Store.toggleSaved(d);
      e.currentTarget.textContent = on ? '🔖 Gespeichert' : '🔖 Später';
      toast(on ? 'Für später gespeichert' : 'Aus „Später“ entfernt');
    });
    info.querySelector('#shareBtn').addEventListener('click', async () => {
      const url = 'https://www.youtube.com/watch?v=' + id;
      try {
        if (navigator.share) await navigator.share({ title: d.title, url });
        else { await navigator.clipboard.writeText(url); toast('Link kopiert'); }
      } catch (e) { /* cancelled */ }
    });
    info.querySelector('#hideBtn').addEventListener('click', () => {
      if (!confirm(`„${d.uploaderName}“ ausblenden? Videos dieses Kanals erscheinen dann nirgends mehr. Rückgängig in den Einstellungen.`)) return;
      Store.hideChannel({ id: d.uploaderUrl, name: d.uploaderName, avatar: d.uploaderAvatar });
      toast('Kanal ausgeblendet');
      history.length > 1 ? history.back() : (location.hash = '#/');
    });
    info.querySelector('.reactions').addEventListener('click', (e) => {
      const b = e.target.closest('.reaction'); if (!b) return;
      const val = Store.setReaction(d, b.dataset.e);
      info.querySelectorAll('.reaction').forEach(x => { const on = x.dataset.e === val; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      if (val) { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, val); toast(`${val} ${REACTIONS.find(x => x.e === val).name}`); }
    });
    const desc = info.querySelector('#desc');
    desc.addEventListener('click', (e) => {
      const ts = e.target.closest('[data-t]');
      if (ts) { e.preventDefault(); player && player.seek(+ts.dataset.t); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (!e.target.closest('a')) desc.classList.add('open');
    });

    document.getElementById('related').innerHTML = d.related.length
      ? `<h2 style="font-size:17px;margin:4px 0 4px">Als Nächstes</h2>` + d.related.map((v, i) => videoCard(v, i)).join('')
      : '';
  }

  /** Piped descriptions are HTML – keep text, links and timestamps only. */
  function sanitizeDesc(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n');
    const out = [];
    (function walk(node) {
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) out.push(esc(n.textContent));
        else if (n.nodeName === 'A') {
          const href = n.getAttribute('href') || '';
          const text = n.textContent;
          const t = /[?&]t=(\d+)/.exec(href);
          const v = /[?&]v=([\w-]{11})/.exec(href) || /youtu\.be\/([\w-]{11})/.exec(href);
          if (t && /^\d+:\d+/.test(text)) out.push(`<a href="#" data-t="${t[1]}">${esc(text)}</a>`);
          else if (v) out.push(`<a href="#/watch/${v[1]}">${esc(text)}</a>`);
          else if (/^https?:/i.test(href)) out.push(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`);
          else out.push(esc(text));
        } else walk(n);
      });
    })(tmp);
    return out.join('');
  }

  async function pageChannel(id, token) {
    setView(`<div id="ch"><div class="channel-head"><div class="banner skeleton"></div></div>${skeletonGrid(8)}</div>`);
    try {
      const c = await Piped.channel(id);
      if (token !== routeToken) return;
      document.title = c.name + ' · Strova';
      const on = Store.isSubbed(c.id);
      document.getElementById('ch').innerHTML = `
        <div class="channel-head">${c.banner ? `<img class="banner" src="${esc(c.banner)}" alt="" referrerpolicy="no-referrer">` : '<div class="banner"></div>'}</div>
        <div class="channel-info">
          <img src="${esc(c.avatar)}" alt="" referrerpolicy="no-referrer">
          <div class="grow"><h1 class="page-title" style="margin:0">${esc(c.name)}${c.verified ? ' ✓' : ''}</h1><div class="sub">${c.subscribers > 0 ? num(c.subscribers) + ' Abonnenten' : ''}</div></div>
          <button class="btn ${on ? '' : 'primary'}" id="subBtn">${on ? 'Abonniert ✓' : 'Abonnieren'}</button>
          <button class="btn" id="hideCh">${Store.isHidden(c.id) ? '👁 Wieder zeigen' : '🚫 Ausblenden'}</button>
        </div>
        <div class="grid" id="chGrid">${grid(c.videos)}</div>
        ${c.nextpage ? '<div class="more"><button class="btn" id="chMore">Mehr laden</button></div>' : ''}`;
      document.getElementById('subBtn').addEventListener('click', (e) => {
        const now = Store.toggleSub({ id: c.id, name: c.name, avatar: c.avatar });
        e.currentTarget.textContent = now ? 'Abonniert ✓' : 'Abonnieren';
        e.currentTarget.classList.toggle('primary', !now);
        toast(now ? `${c.name} abonniert` : 'Abo entfernt');
      });
      document.getElementById('hideCh').addEventListener('click', (e) => {
        if (Store.isHidden(c.id)) { Store.unhideChannel(c.id); e.currentTarget.textContent = '🚫 Ausblenden'; toast('Kanal wird wieder angezeigt'); }
        else { Store.hideChannel({ id: c.id, name: c.name, avatar: c.avatar }); e.currentTarget.textContent = '👁 Wieder zeigen'; toast('Kanal ausgeblendet'); }
      });
      let next = c.nextpage, offset = c.videos.length;
      const moreBtn = document.getElementById('chMore');
      if (moreBtn) {
        moreBtn.addEventListener('click', async () => {
          moreBtn.disabled = true; moreBtn.textContent = 'Lädt …';
          try {
            const r = await Piped.channel(c.id, next);
            next = r.nextpage;
            document.getElementById('chGrid').insertAdjacentHTML('beforeend', grid(r.videos, offset));
            offset += r.videos.length;
            if (!next || !r.videos.length) moreBtn.parentElement.remove();
            else { moreBtn.disabled = false; moreBtn.textContent = 'Mehr laden'; observeMore(moreBtn); }
          } catch (e) { moreBtn.disabled = false; moreBtn.textContent = 'Mehr laden'; toast('Konnte nicht mehr laden'); }
        });
        observeMore(moreBtn);
      }
    } catch (err) {
      if (token !== routeToken) return;
      document.getElementById('ch').innerHTML = errorState(err);
      bindRetry(() => route());
    }
  }

  async function pageFeed(token) {
    const subs = Store.subs();
    if (!subs.length) {
      setView(`<h1 class="page-title">Abos</h1>` + emptyState('📺', 'Noch keine Abos', 'Abonniere Kanäle – ganz ohne Konto. Deine Abos bleiben auf diesem Gerät.', '<a class="btn primary" href="#/">Entdecken</a>'));
      return;
    }
    setView(`
      <h1 class="page-title">Abos</h1>
      <div class="chips">${subs.map(s => `<a class="chip" href="#/channel/${esc(s.id)}" style="display:flex;align-items:center;gap:8px;padding:5px 14px 5px 5px"><img src="${esc(s.avatar)}" alt="" style="width:26px;height:26px;border-radius:50%" referrerpolicy="no-referrer">${esc(s.name)}</a>`).join('')}</div>
      <div class="section"><h2>Neueste Videos</h2></div>
      <div id="list">${skeletonGrid()}</div>`);
    try {
      const items = await Piped.feed(subs.map(s => s.id));
      if (token !== routeToken) return;
      document.getElementById('list').innerHTML = items.length ? `<div class="grid">${grid(items.slice(0, 120))}</div>` : emptyState('🌱', 'Noch nichts Neues', 'Deine Kanäle haben keine neuen Videos.');
    } catch (err) {
      if (token !== routeToken) return;
      document.getElementById('list').innerHTML = errorState(err);
      bindRetry(() => route());
    }
  }

  function pageLibrary(tab, sub) {
    tab = tab || 'history';
    const tabs = [['history', '🕘 Verlauf'], ['saved', '🔖 Später'], ['reactions', '💫 Reaktionen'], ['subs', '📺 Abos']];
    let body = '';
    if (tab === 'history') {
      const h = Store.history();
      body = h.length ? `<div class="section"><span class="sub">${h.length} Videos</span><button class="btn danger" id="clearHist">Verlauf löschen</button></div><div class="grid">${grid(h)}</div>`
        : emptyState('🕘', 'Verlauf ist leer', Store.settings().saveHistory ? 'Videos, die du schaust, erscheinen hier.' : 'Der Verlauf ist in den Einstellungen ausgeschaltet.');
    } else if (tab === 'saved') {
      const s = Store.saved();
      body = s.length ? `<div class="grid">${grid(s)}</div>` : emptyState('🔖', 'Nichts gespeichert', 'Tippe unter einem Video auf „Später“.');
    } else if (tab === 'reactions') {
      const all = Object.values(Store.reactions()).sort((a, b) => b.at - a.at);
      const filter = sub ? decodeURIComponent(sub) : '';
      const list = filter ? all.filter(r => r.emoji === filter) : all;
      body = `<div class="chips"><a class="chip ${!filter ? 'active' : ''}" href="#/library/reactions">Alle · ${all.length}</a>${REACTIONS.map(r => `<a class="chip ${filter === r.e ? 'active' : ''}" href="#/library/reactions/${encodeURIComponent(r.e)}">${r.e} ${esc(r.name)} · ${all.filter(x => x.emoji === r.e).length}</a>`).join('')}</div>`
        + (list.length ? `<div class="grid" style="margin-top:14px">${grid(list)}</div>` : emptyState('💫', 'Keine Reaktionen', 'Reagiere unter Videos mit einem Emoji.'));
    } else if (tab === 'subs') {
      const s = Store.subs();
      body = s.length ? `<div class="grid">${s.map((c, i) => channelCard({ id: c.id, name: c.name, avatar: c.avatar }, i)).join('')}</div>` : emptyState('📺', 'Keine Abos', 'Abonnierte Kanäle erscheinen hier.');
    }
    setView(`<h1 class="page-title">Sammlung</h1>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'active' : ''}" data-t="${k}">${l}</button>`).join('')}</div>${body}`);
    view.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) location.hash = '#/library/' + b.dataset.t; });
    const ch = document.getElementById('clearHist');
    if (ch) ch.addEventListener('click', () => { if (confirm('Verlauf und Wiedergabepositionen löschen?')) { Store.clearHistory(); pageLibrary('history'); toast('Verlauf gelöscht'); } });
  }

  // ───────── Music ─────────
  const GENRES = [
    { name: 'Charts', q: 'top hits 2026 charts', bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', emo: '🏆' },
    { name: 'Deutschrap', q: 'deutschrap neu', bg: 'linear-gradient(135deg,#111827,#ef4444)', emo: '🎤' },
    { name: 'Pop', q: 'pop hits', bg: 'linear-gradient(135deg,#f472b6,#fb923c)', emo: '✨' },
    { name: 'Chill', q: 'chill lofi beats', bg: 'linear-gradient(135deg,#0ea5e9,#6366f1)', emo: '🌙' },
    { name: 'Party', q: 'party hits remix', bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', emo: '🎉' },
    { name: 'Workout', q: 'workout gym music', bg: 'linear-gradient(135deg,#22c55e,#0ea5e9)', emo: '💪' },
    { name: 'Rock', q: 'rock classics', bg: 'linear-gradient(135deg,#475569,#dc2626)', emo: '🎸' },
    { name: 'Electronic', q: 'edm electronic hits', bg: 'linear-gradient(135deg,#06b6d4,#a855f7)', emo: '🎧' },
    { name: 'Fokus', q: 'focus study music', bg: 'linear-gradient(135deg,#14b8a6,#3b82f6)', emo: '🧠' },
    { name: 'Gefühle', q: 'sad songs emotional', bg: 'linear-gradient(135deg,#6366f1,#ec4899)', emo: '🥹' },
  ];
  const musicLists = {}; // listKey -> tracks, used by click handlers
  // real songs, not hour-long mixes or shorts
  const isSong = (x) => x.type === 'video' && !x.live && !x.isShort && x.duration >= 60 && x.duration <= 600;

  function trackRow(t, i, listKey, opts = {}) {
    const cur = Music.current();
    return `<li class="trow ${cur && cur.id === t.id ? 'playing' : ''}" data-track-id="${esc(t.id)}" data-list="${listKey}" data-i="${i}" style="animation-delay:${Math.min(i, 20) * 25}ms">
      <span class="tnum">${i + 1}</span>
      <span class="tcover"><img src="${esc(t.thumbnail || t.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="tplay">${Music.ICON.play}</span><span class="tnow"><span class="eq"><i></i><i></i><i></i></span></span></span>
      <span class="tmeta"><b>${esc(t.title)}</b><small>${esc((t.uploaderName || t.artist || '').replace(/ - Topic$/, ''))}</small></span>
      <span class="tdur">${t.duration > 0 ? fmt(t.duration) : ''}</span>
      <span class="tact">
        <button class="m-icon small t-like ${Music.Library.isLiked(t.id) ? 'on' : ''}" aria-label="Lieblingssong">${Music.ICON.heart}</button>
        <button class="m-icon small t-more" aria-label="Mehr Optionen">⋯</button>
        ${opts.removable ? `<button class="m-icon small t-rm" aria-label="Aus Playlist entfernen">✕</button>` : ''}
      </span>
    </li>`;
  }
  function trackList(tracks, listKey, opts) {
    musicLists[listKey] = tracks;
    return `<ol class="tracks">${tracks.map((t, i) => trackRow(t, i, listKey, opts)).join('')}</ol>`;
  }
  function trackMenu(btn, t) {
    document.querySelectorAll('.tmenu').forEach(m => m.remove());
    const m = document.createElement('div');
    m.className = 'tmenu';
    m.innerHTML = `<button data-a="next">▶︎ Als Nächstes spielen</button><button data-a="queue">☰ Zur Warteschlange</button><button data-a="pl">＋ Zur Playlist</button><button data-a="video">🎬 Musikvideo ansehen</button>${t.uploaderUrl || t.artistId ? '<button data-a="artist">👤 Zum Künstler</button>' : ''}`;
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = Math.min(window.innerHeight - m.offsetHeight - 10, r.bottom + 4) + 'px';
    m.style.left = Math.max(10, r.right - m.offsetWidth) + 'px';
    const close = () => { m.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = (e) => { if (!m.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    m.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'next') Music.playNext(t);
      if (a.dataset.a === 'queue') Music.addToQueue(t);
      if (a.dataset.a === 'pl') Music.pickPlaylist(t);
      if (a.dataset.a === 'video') location.hash = '#/watch/' + t.id;
      if (a.dataset.a === 'artist') location.hash = '#/channel/' + (t.uploaderUrl || t.artistId);
      close();
    });
  }
  // one delegated handler for every track list on any page
  view.addEventListener('click', (e) => {
    const row = e.target.closest('.trow'); if (!row) return;
    const list = musicLists[row.dataset.list] || [];
    const i = +row.dataset.i, t = list[i]; if (!t) return;
    if (e.target.closest('.t-like')) {
      const on = Music.Library.toggleLike(t);
      e.target.closest('.t-like').classList.toggle('on', on);
      toast(on ? '❤️ Zu Lieblingssongs hinzugefügt' : 'Aus Lieblingssongs entfernt');
      return;
    }
    if (e.target.closest('.t-more')) { trackMenu(e.target.closest('.t-more'), t); return; }
    if (e.target.closest('.t-rm')) {
      Music.Library.removeFromPlaylist(row.dataset.list.replace('pl:', ''), t.id);
      route(); return;
    }
    const cur = Music.current();
    if (cur && cur.id === t.id) Music.toggle(); else Music.play(list, i);
  });
  window.addEventListener('strova:music-lib', () => {
    document.querySelectorAll('.trow').forEach(r => {
      const b = r.querySelector('.t-like'); if (b) b.classList.toggle('on', Music.Library.isLiked(r.dataset.trackId));
    });
  });

  function musicTabs(active) {
    const tabs = [['', '✨ Entdecken'], ['liked', '❤️ Lieblingssongs'], ['playlists', '🎵 Playlists'], ['recent', '🕘 Zuletzt']];
    return `<div class="tabs">${tabs.map(([k, l]) => `<button class="${k === active ? 'active' : ''}" data-mt="${k}">${l}</button>`).join('')}</div>`;
  }
  function bindMusicTabs() {
    const t = view.querySelector('.tabs');
    if (t) t.addEventListener('click', (e) => { const b = e.target.closest('[data-mt]'); if (b) location.hash = '#/music' + (b.dataset.mt ? '/' + b.dataset.mt : ''); });
    const f = view.querySelector('.msearch');
    if (f) f.addEventListener('submit', (e) => { e.preventDefault(); const q = f.querySelector('input').value.trim(); if (q) location.hash = '#/music/search?q=' + encodeURIComponent(q); });
  }
  const musicHead = (active, q) => `
    <div class="mhero">
      <div><h1 class="page-title">Musik</h1><p class="page-sub" style="margin:0">Songs, Künstler und Playlists – werbefrei und ohne Konto.</p></div>
      <form class="msearch" role="search"><input type="search" placeholder="Song oder Künstler suchen" value="${esc(q || '')}" enterkeyhint="search" aria-label="Musik suchen"><button class="btn primary">Suchen</button></form>
    </div>${musicTabs(active)}`;

  async function pageMusic(sub, arg, params, token) {
    if (sub === 'search') return pageMusicSearch(params.get('q') || '', token);
    if (sub === 'liked') {
      const liked = Music.Library.liked();
      setView(musicHead('liked') + `
        <div class="plhead"><div class="pl-cover big liked">❤️</div><div><small>Playlist</small><h2>Lieblingssongs</h2><span class="sub">${liked.length} Songs</span>
        ${liked.length ? `<div class="plbtns"><button class="btn primary" id="playAll">${Music.ICON.play} Abspielen</button><button class="btn" id="shuf">${Music.ICON.shuffle} Zufällig</button></div>` : ''}</div></div>
        ${liked.length ? trackList(liked, 'liked') : emptyState('❤️', 'Noch keine Lieblingssongs', 'Tippe bei einem Song auf das Herz.')}`);
      bindMusicTabs(); bindPlayAll(liked);
      return;
    }
    if (sub === 'recent') {
      const rec = Music.Library.recent();
      setView(musicHead('recent') + (rec.length ? trackList(rec, 'recent') : emptyState('🕘', 'Noch nichts gehört', 'Gehörte Songs erscheinen hier.')));
      bindMusicTabs(); return;
    }
    if (sub === 'playlists') {
      const lists = Music.Library.playlists();
      setView(musicHead('playlists') + `
        <div class="section"><h2>Deine Playlists</h2><button class="btn primary" id="newPl">${Music.ICON.plus} Neue Playlist</button></div>
        ${lists.length ? `<div class="plgrid">${lists.map((p, i) => plCard(p, i)).join('')}</div>` : emptyState('🎵', 'Noch keine Playlists', 'Erstelle eine Playlist und füge Songs über „⋯“ hinzu.')}`);
      bindMusicTabs();
      document.getElementById('newPl').addEventListener('click', () => {
        const name = prompt('Name der Playlist'); if (!name || !name.trim()) return;
        const p = Music.Library.createPlaylist(name); location.hash = '#/music/playlist/' + p.id;
      });
      return;
    }
    if (sub === 'playlist') {
      const p = Music.Library.playlist(arg);
      if (!p) { location.hash = '#/music/playlists'; return; }
      setView(musicHead('playlists') + `
        <div class="plhead">${plCover(p, 'big')}<div><small>Playlist</small><h2>${esc(p.name)}</h2><span class="sub">${p.tracks.length} Songs · ${fmt(p.tracks.reduce((s, t) => s + (t.duration || 0), 0))}</span>
        <div class="plbtns">${p.tracks.length ? `<button class="btn primary" id="playAll">${Music.ICON.play} Abspielen</button><button class="btn" id="shuf">${Music.ICON.shuffle} Zufällig</button>` : ''}<button class="btn danger" id="delPl">Löschen</button></div></div></div>
        ${p.tracks.length ? trackList(p.tracks, 'pl:' + p.id, { removable: true }) : emptyState('🎶', 'Leere Playlist', 'Füge Songs über „⋯ → Zur Playlist“ hinzu.')}`);
      bindMusicTabs(); bindPlayAll(p.tracks);
      document.getElementById('delPl').addEventListener('click', () => {
        if (confirm(`Playlist „${p.name}“ löschen?`)) { Music.Library.deletePlaylist(p.id); location.hash = '#/music/playlists'; toast('Playlist gelöscht'); }
      });
      return;
    }

    // Discover
    const liked = Music.Library.liked(), lists = Music.Library.playlists(), rec = Music.Library.recent();
    const hour = new Date().getHours();
    const pick = hour < 10 ? GENRES[3] : hour < 17 ? GENRES[8] : hour < 22 ? GENRES[0] : GENRES[3];
    setView(musicHead('') + `
      <div class="quick">
        <a class="quick-item" href="#/music/liked"><span class="pl-cover liked">❤️</span><b>Lieblingssongs</b><small>${liked.length}</small></a>
        ${lists.slice(0, 3).map(p => `<a class="quick-item" href="#/music/playlist/${p.id}">${plCover(p)}<b>${esc(p.name)}</b><small>${p.tracks.length}</small></a>`).join('')}
        ${rec.slice(0, Math.max(0, 5 - lists.slice(0, 3).length)).map((t, i) => `<button class="quick-item" data-recent="${i}"><span class="pl-cover"><img src="${esc(t.cover)}" alt="" referrerpolicy="no-referrer"></span><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></button>`).join('')}
      </div>
      <div class="section"><h2>Genres & Stimmungen</h2></div>
      <div class="genres">${GENRES.map((g, i) => `<button class="genre" data-g="${i}" style="background:${g.bg};animation-delay:${i * 35}ms"><b>${g.name}</b><span>${g.emo}</span></button>`).join('')}</div>
      <div class="section"><h2 id="pickTitle">${pick.emo} Für dich: ${pick.name}</h2><button class="btn" id="pickPlay">${Music.ICON.play} Alle abspielen</button></div>
      <div id="pickList">${trackSkeleton()}</div>`);
    bindMusicTabs();
    view.querySelectorAll('[data-recent]').forEach(b => b.addEventListener('click', () => Music.play(rec, +b.dataset.recent)));
    let currentList = [];
    async function loadGenre(g) {
      document.getElementById('pickTitle').textContent = `${g.emo} ${g.name}`;
      document.getElementById('pickList').innerHTML = trackSkeleton();
      try {
        const r = await Piped.search(g.q, 'music_songs');
        if (token !== routeToken) return;
        currentList = r.items.filter(isSong);
        document.getElementById('pickList').innerHTML = currentList.length ? trackList(currentList, 'genre') : emptyState('🔇', 'Keine Songs', 'Diese Instanz liefert gerade keine Musik.');
      } catch (err) {
        if (token !== routeToken) return;
        document.getElementById('pickList').innerHTML = errorState(err);
        bindRetry(() => loadGenre(g));
      }
    }
    view.querySelector('.genres').addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      view.querySelectorAll('.genre').forEach(x => x.classList.toggle('active', x === b));
      loadGenre(GENRES[+b.dataset.g]);
      document.getElementById('pickTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('pickPlay').addEventListener('click', () => { if (currentList.length) Music.play(currentList, 0); });
    loadGenre(pick);
  }

  async function pageMusicSearch(q, token) {
    setView(musicHead('', q) + `<div class="section"><h2>Songs zu „${esc(q)}“</h2></div><div id="songs">${trackSkeleton()}</div>
      <div class="section"><h2>Künstler</h2></div><div id="artists" class="artists"></div>`);
    bindMusicTabs();
    try {
      const [songs, artists] = await Promise.all([
        Piped.search(q, 'music_songs'),
        Piped.search(q, 'music_artists').catch(() => ({ items: [] })),
      ]);
      if (token !== routeToken) return;
      const all = songs.items.filter(x => x.type === 'video');
      const list = all.filter(isSong).length ? all.filter(isSong) : all;
      document.getElementById('songs').innerHTML = list.length ? trackList(list, 'search') : emptyState('🔍', 'Keine Songs gefunden', 'Versuche einen anderen Suchbegriff.');
      const arts = artists.items.filter(x => x.type === 'channel').slice(0, 10);
      document.getElementById('artists').innerHTML = arts.map((a, i) => `<a class="artist" href="#/channel/${esc(a.id)}" style="animation-delay:${i * 40}ms"><img src="${esc(a.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer"><b>${esc(a.name)}</b><small>Künstler</small></a>`).join('') || '<p class="sub">Keine Künstler gefunden.</p>';
    } catch (err) {
      if (token !== routeToken) return;
      document.getElementById('songs').innerHTML = errorState(err);
      bindRetry(() => route());
    }
  }

  function plCover(p, size) {
    const covers = p.tracks.slice(0, 4).map(t => t.cover);
    if (covers.length >= 4) return `<span class="pl-cover mosaic ${size || ''}">${covers.map(c => `<img src="${esc(c)}" alt="" referrerpolicy="no-referrer">`).join('')}</span>`;
    if (covers.length) return `<span class="pl-cover ${size || ''}"><img src="${esc(covers[0])}" alt="" referrerpolicy="no-referrer"></span>`;
    return `<span class="pl-cover ${size || ''}">🎵</span>`;
  }
  function plCard(p, i) {
    return `<a class="plcard" href="#/music/playlist/${p.id}" style="animation-delay:${i * 40}ms">${plCover(p, 'card')}<b>${esc(p.name)}</b><small>${p.tracks.length} Songs</small></a>`;
  }
  function bindPlayAll(list) {
    const a = document.getElementById('playAll'), s = document.getElementById('shuf');
    if (a) a.addEventListener('click', () => Music.play(list, 0));
    if (s) s.addEventListener('click', () => Music.play(list, Math.floor(Math.random() * list.length)));
  }
  const trackSkeleton = () => '<ol class="tracks">' + Array.from({ length: 8 }, () => '<li class="trow"><span class="tnum"></span><span class="tcover skeleton"></span><span class="tmeta"><span class="skeleton sk-line" style="width:60%;margin:0"></span><span class="skeleton sk-line" style="width:35%"></span></span></li>').join('') + '</ol>';

  const REGIONS = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', US: 'USA', GB: 'Großbritannien', FR: 'Frankreich', IT: 'Italien', ES: 'Spanien', NL: 'Niederlande', PL: 'Polen', TR: 'Türkei', JP: 'Japan', BR: 'Brasilien', IN: 'Indien' };
  const regionName = (r) => REGIONS[r] || r;

  async function pageSettings() {
    const s = Store.settings();
    const be = s.backend === 'invidious' ? 'invidious' : 'piped';
    const curInst = be === 'invidious' ? s.invInstance : s.instance;
    const sw = (key, title, text) => `<div class="row"><label for="s_${key}"><b>${title}</b><small>${text}</small></label><span class="switch"><input type="checkbox" id="s_${key}" data-k="${key}" ${s[key] ? 'checked' : ''}><span></span></span></div>`;
    const group = (icon, title) => `<h2 class="set-group">${icon} ${title}</h2>`;
    const SB = [['sponsor', 'Sponsoren'], ['selfpromo', 'Eigenwerbung'], ['interaction', 'Abo-/Like-Erinnerungen'], ['intro', 'Intros'], ['outro', 'Abspann'], ['preview', 'Vorschauen'], ['filler', 'Füller'], ['music_offtopic', 'Nicht-Musik in Musikvideos']];
    const hidden = Store.hidden();
    setView(`
      <h1 class="page-title">Einstellungen</h1>
      <p class="page-sub">Alles wird nur auf diesem Gerät gespeichert. Kein Konto, kein Tracking.</p>
      <div class="panel">
        ${group('🛰️', 'Quelle')}
        <div class="row"><label><b>Video-Quelle (API)</b><small>Piped oder Invidious – beide laden YouTube ohne Google-Konto</small></label>
          <div class="seg" role="radiogroup"><button data-be="piped" class="${be === 'piped' ? 'active' : ''}" role="radio" aria-checked="${be === 'piped'}">Piped</button><button data-be="invidious" class="${be === 'invidious' ? 'active' : ''}" role="radio" aria-checked="${be === 'invidious'}">Invidious</button></div></div>
        ${be === 'invidious' && !Piped.isNativeApp ? `<div class="row note"><label><b>ℹ️ Hinweis zu Invidious</b><small>Die meisten öffentlichen Invidious-Server erlauben keinen Zugriff aus dem Browser. In der Desktop- und Android-App von Strova funktioniert Invidious ohne Einschränkung – im Browser nur mit einer Instanz, die das erlaubt (z. B. deine eigene).</small></label></div>` : ''}
        <div class="row"><label for="s_instance"><b>${be === 'invidious' ? 'Invidious' : 'Piped'}-Instanz</b><small>Fällt sie aus, wechselt Strova automatisch</small></label>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select id="s_instance"><option>${esc(curInst)}</option></select><button class="btn" id="testInst">Testen</button></span></div>
        <div class="row"><label for="s_custom"><b>Eigene Instanz</b><small>API-Adresse, z. B. ${be === 'invidious' ? 'https://invidious.example.org' : 'https://pipedapi.example.org'}</small></label><input type="text" id="s_custom" placeholder="https://…" inputmode="url"></div>
        <div class="row"><label for="s_region"><b>Region für Trends</b><small>Welche Trends du auf der Startseite siehst</small></label><select id="s_region">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${k === s.region ? 'selected' : ''}>${v}</option>`).join('')}</select></div>

        ${group('🎨', 'Darstellung')}
        <div class="row"><label for="s_theme"><b>Design</b><small>Hell, Dunkel oder wie das System</small></label><select id="s_theme"><option value="system">System</option><option value="dark">Dunkel</option><option value="light">Hell</option></select></div>
        ${sw('hideShorts', 'Shorts ausblenden', 'Kurzvideos aus Trends, Suche und Abos entfernen')}
        ${sw('hideLive', 'Livestreams ausblenden', 'Laufende Livestreams nicht anzeigen')}

        ${group('▶️', 'Wiedergabe')}
        <div class="row"><label for="s_quality"><b>Standardqualität</b><small>„Auto“ passt sich deiner Verbindung an</small></label>
          <select id="s_quality">${['auto', '1080', '720', '480', '360', '240', '144'].map(q => `<option value="${q}" ${String(s.defaultQuality) === q ? 'selected' : ''}>${q === 'auto' ? 'Auto' : q + 'p'}</option>`).join('')}</select></div>
        <div class="row"><label for="s_speed"><b>Standardgeschwindigkeit</b><small>Gilt für neue Videos</small></label>
          <select id="s_speed">${[0.75, 1, 1.25, 1.5, 1.75, 2].map(v => `<option value="${v}" ${+s.defaultSpeed === v ? 'selected' : ''}>${v === 1 ? 'Normal' : v + '×'}</option>`).join('')}</select></div>
        ${sw('autoplayNext', 'Automatisch weiter', 'Nach dem Video das nächste abspielen')}
        ${sw('resume', 'Fortsetzen', 'Videos dort weiterschauen, wo du aufgehört hast')}
        ${sw('preferHls', 'Adaptive Qualität (HLS)', 'Wenn verfügbar, Qualität automatisch anpassen')}
        ${sw('captions', 'Untertitel automatisch', 'Untertitel in deiner Sprache einschalten, wenn vorhanden')}

        ${group('⏭', 'SponsorBlock')}
        ${sw('sponsorBlock', 'SponsorBlock', 'Werbeabschnitte automatisch überspringen (Daten von sponsor.ajay.app)')}
        <div class="row sb-cats" ${s.sponsorBlock ? '' : 'hidden'}><label><b>Überspringen</b><small>Welche Abschnitte übersprungen werden</small></label>
          <div class="chips wrap">${SB.map(([k, l]) => `<button class="chip ${s.sbCategories.includes(k) ? 'active' : ''}" data-sb="${k}">${l}</button>`).join('')}</div></div>

        ${group('🚫', 'Ausgeblendete Kanäle')}
        <div class="row" style="display:block">
          <label><b>${hidden.length ? hidden.length + ' Kanäle ausgeblendet' : 'Keine Kanäle ausgeblendet'}</b><small>Videos dieser Kanäle erscheinen nirgends mehr. Ausblenden über die Kanalseite oder „Kanal ausblenden“ unter einem Video.</small></label>
          ${hidden.length ? `<div class="hidden-list">${hidden.map(h => `<div class="hidden-item">${h.avatar ? `<img src="${esc(h.avatar)}" alt="" referrerpolicy="no-referrer">` : '<span class="pl-cover sm">👤</span>'}<b>${esc(h.name)}</b><button class="btn" data-unhide="${esc(h.id)}">Wieder zeigen</button></div>`).join('')}</div>` : ''}
        </div>

        ${group('🗂️', 'Daten')}
        ${sw('saveHistory', 'Verlauf speichern', 'Gesehene Videos merken')}
        <div class="row"><label><b>Sichern & Übertragen</b><small>Export/Import von Abos, Verlauf, Reaktionen. Import versteht auch LibreTube/NewPipe-Abo-Exporte (JSON).</small></label>
          <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="exp">Exportieren</button><button class="btn" id="imp">Importieren</button></span></div>
        <div class="row"><label><b>Alles zurücksetzen</b><small>Löscht Einstellungen, Abos, Verlauf, Musik-Bibliothek</small></label><button class="btn danger" id="reset">Zurücksetzen</button></div>

        ${group('⌨️', 'Tastenkürzel')}
        <div class="row"><label><small>Leertaste/K Pause · J/L ±10 s · ←/→ ±5 s · F Vollbild · M Ton · C Untertitel · I Bild im Bild · &lt;/&gt; Tempo · / Suche</small></label></div>
        <p class="sub" style="text-align:center;margin-top:10px">Strova ${esc(window.STROVA_VERSION || '')} · Inhalte stammen von YouTube und gehören ihren Urhebern. Strova ist nicht mit YouTube oder Google verbunden.</p>
      </div>`);

    const theme = document.getElementById('s_theme');
    theme.value = s.theme;
    theme.addEventListener('change', () => { Store.setSetting('theme', theme.value); applyTheme(); });
    view.querySelectorAll('[data-k]').forEach(i => i.addEventListener('change', () => {
      Store.setSetting(i.dataset.k, i.checked); toast('Gespeichert');
      if (i.dataset.k === 'sponsorBlock') view.querySelector('.sb-cats').hidden = !i.checked;
    }));
    view.querySelectorAll('[data-be]').forEach(b => b.addEventListener('click', () => {
      Store.setSetting('backend', b.dataset.be); toast('Quelle: ' + (b.dataset.be === 'invidious' ? 'Invidious' : 'Piped')); pageSettings();
    }));
    view.querySelectorAll('[data-sb]').forEach(b => b.addEventListener('click', () => {
      const cur = new Set(Store.settings().sbCategories);
      cur.has(b.dataset.sb) ? cur.delete(b.dataset.sb) : cur.add(b.dataset.sb);
      Store.setSetting('sbCategories', [...cur]); b.classList.toggle('active');
    }));
    view.querySelectorAll('[data-unhide]').forEach(b => b.addEventListener('click', () => { Store.unhideChannel(b.dataset.unhide); toast('Kanal wird wieder angezeigt'); pageSettings(); }));
    document.getElementById('s_quality').addEventListener('change', (e) => { Store.setSetting('defaultQuality', e.target.value); toast('Gespeichert'); });
    document.getElementById('s_speed').addEventListener('change', (e) => { Store.setSetting('defaultSpeed', +e.target.value); toast('Gespeichert'); });
    document.getElementById('s_region').addEventListener('change', (e) => { Store.setSetting('region', e.target.value); toast('Region: ' + regionName(e.target.value)); });
    const instKey = be === 'invidious' ? 'invInstance' : 'instance';
    const custom = document.getElementById('s_custom');
    custom.addEventListener('change', () => {
      const v = custom.value.trim().replace(/\/$/, '');
      if (!/^https:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(v)) { toast('Bitte eine https-Adresse eingeben'); return; }
      Store.setSetting(instKey, v); toast('Instanz gesetzt'); pageSettings();
    });
    document.getElementById('testInst').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = '…';
      const t0 = performance.now();
      try { await Piped.trending(Store.settings().region); toast(`✅ Instanz antwortet (${Math.round(performance.now() - t0)} ms)`); }
      catch (err) { toast('❌ Instanz antwortet nicht'); }
      b.disabled = false; b.textContent = 'Testen';
    });
    document.getElementById('exp').addEventListener('click', () => {
      const data = Object.assign(Store.exportAll(), { music: { liked: Music.Library.liked(), playlists: Music.Library.playlists() } });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'strova-backup.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    document.getElementById('imp').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        try {
          const data = JSON.parse(await inp.files[0].text());
          Store.importAll(data);
          if (data.music) {
            try { if (data.music.liked) localStorage.setItem('strova.music.liked', JSON.stringify(data.music.liked)); if (data.music.playlists) localStorage.setItem('strova.music.playlists', JSON.stringify(data.music.playlists)); } catch (e) {}
          }
          applyTheme(); toast('Daten importiert'); pageSettings();
        } catch (e) { toast('Datei konnte nicht gelesen werden'); }
      };
      inp.click();
    });
    document.getElementById('reset').addEventListener('click', () => {
      if (!confirm('Wirklich alles zurücksetzen? Abos, Verlauf, Playlists und Einstellungen werden gelöscht.')) return;
      try { Object.keys(localStorage).filter(k => k.startsWith('strova.')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      location.hash = '#/'; location.reload();
    });

    const sel = document.getElementById('s_instance');
    const list = await Piped.instances(be);
    if (!document.body.contains(sel)) return;
    const urls = list.map(i => i.url);
    sel.innerHTML = (urls.includes(curInst) ? '' : `<option value="${esc(curInst)}">${esc(curInst)}</option>`) +
      list.map(i => `<option value="${esc(i.url)}">${esc(i.name)}${i.locations ? ' · ' + esc(i.locations) : ''}</option>`).join('');
    sel.value = curInst;
    sel.addEventListener('change', () => { Store.setSetting(instKey, sel.value); toast('Instanz gewechselt'); });
  }

  // ───────── Router ─────────
  function route() {
    const token = ++routeToken;
    if (player) { player.destroy(); player = null; }
    document.title = 'Strova';
    const hash = location.hash.replace(/^#/, '') || '/';
    const [path, query] = hash.split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    const top = parts[0] || 'home';
    document.querySelectorAll('.nav a').forEach(a => {
      const r = a.dataset.route;
      a.classList.toggle('active', r === top || (r === 'moods' && top === 'mood'));
      if (a.classList.contains('active')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (top !== 'search') document.getElementById('searchInput').value = '';
    switch (top) {
      case 'home': return pageHome(token);
      case 'music': return pageMusic(parts[1], parts[2], params, token);
      case 'moods': return pageMoods();
      case 'mood': return pageMood(parts[1], token);
      case 'search': return pageSearch(params.get('q') || '', params.get('f'), token);
      case 'watch': return pageWatch(parts[1], token, params.has('t') ? +params.get('t') : null);
      case 'channel': return pageChannel(parts[1], token);
      case 'feed': return pageFeed(token);
      case 'library': return pageLibrary(parts[1], parts[2]);
      case 'settings': return pageSettings();
      default: setView(emptyState('🧭', 'Seite nicht gefunden', 'Diese Adresse gibt es nicht.', '<a class="btn primary" href="#/">Zur Startseite</a>'));
    }
  }

  // ───────── Search + suggestions ─────────
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const sugBox = document.getElementById('suggestions');
  let sugTimer = null, sugIndex = -1;
  function hideSug() { sugBox.hidden = true; sugIndex = -1; }
  function runSearch(q) {
    q = q.trim(); if (!q) return;
    hideSug(); input.blur();
    const id = Piped.idFromUrl(q);
    if (/youtu\.?be/.test(q) && /^[\w-]{11}$/.test(id)) { location.hash = '#/watch/' + id; return; }
    location.hash = '#/search?q=' + encodeURIComponent(q);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); const sel = sugBox.querySelector('[aria-selected="true"]'); runSearch(sel ? sel.textContent : input.value); });
  input.addEventListener('input', () => {
    clearTimeout(sugTimer);
    const q = input.value.trim();
    if (q.length < 2) { hideSug(); return; }
    sugTimer = setTimeout(async () => {
      const list = (await Piped.suggestions(q)).slice(0, 8);
      if (input.value.trim() !== q || !list.length || document.activeElement !== input) { if (!list.length) hideSug(); return; }
      sugBox.innerHTML = list.map(s => `<li role="option">${esc(s)}</li>`).join('');
      sugBox.hidden = false; sugIndex = -1;
    }, 180);
  });
  input.addEventListener('keydown', (e) => {
    const items = [...sugBox.querySelectorAll('li')];
    if (sugBox.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute('aria-selected', i === sugIndex));
    } else if (e.key === 'Escape') hideSug();
  });
  sugBox.addEventListener('pointerdown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); input.value = li.textContent; runSearch(li.textContent); } });
  input.addEventListener('blur', () => setTimeout(hideSug, 150));
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });

  // ───────── Theme ─────────
  function applyTheme() {
    const t = Store.settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    const dark = t === 'dark' || (t === 'system' && !matchMedia('(prefers-color-scheme: light)').matches);
    document.querySelector('meta[name=theme-color]').content = dark ? '#0c0b12' : '#f7f5fc';
  }
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    Store.setSetting('theme', cur === 'dark' ? 'light' : 'dark');
    applyTheme();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

  window.addEventListener('strova:instance', (e) => toast('Gewechselt auf ' + new URL(e.detail).hostname));
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => toast('Wieder online'));
  window.addEventListener('offline', () => toast('Keine Internetverbindung'));

  // Sharp images: step down maxres → hq720 → hqdefault when a size doesn't exist.
  // (YouTube answers a missing size with a tiny 120×90 grey placeholder instead of an error.)
  function stepDown(img) {
    const s = img.currentSrc || img.src;
    let next = null;
    if (/\/maxresdefault(_live)?\./.test(s)) next = s.replace(/\/maxresdefault(_live)?\./, '/hq720$1.');
    else if (/\/hq720(_live)?\./.test(s)) next = s.replace(/\/hq720(_live)?\./, '/hqdefault$1.');
    else if (/=s240(-|$)/.test(s) && !img.dataset.avfb) { img.dataset.avfb = '1'; next = s.replace(/=s240(-|$)/, '=s88$1'); }
    if (next && next !== s) img.src = next;
  }
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') stepDown(e.target); }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.naturalWidth > 0 && img.naturalWidth <= 120 && /\/(maxresdefault|hq720)/.test(img.src)) stepDown(img);
  }, true);

  // Desktop app: open external links in the system browser instead of inside the app window
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[target="_blank"]');
    const opener = window.__TAURI__ && window.__TAURI__.opener;
    if (a && opener && /^https?:/i.test(a.href)) { e.preventDefault(); opener.openUrl(a.href); }
  });

  window.STROVA_VERSION = '1.0.0';
  applyTheme();
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
