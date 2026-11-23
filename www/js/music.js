/* Strova Music – audio player with queue, mini bar, "now playing" sheet, liked songs, playlists, radio */
(function () {
  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l10.8-6.9a1 1 0 0 0 0-1.7L9.5 4.2A1 1 0 0 0 8 5.1Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M5 5.5v13a1 1 0 0 0 1.6.8L15 13v5h2V6h-2v5L6.6 4.7A1 1 0 0 0 5 5.5Z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M19 5.5v13a1 1 0 0 1-1.6.8L9 13v5H7V6h2v5l8.4-6.3A1 1 0 0 1 19 5.5Z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.6l-3.2 4 3.2 4H17v-3l4 4-4 4v-3h-3.6l-3.7-4.6L6 18H3v-2h2l3.4-4L5 8H3V6h3l3.8 4.6L13.4 6H17V3Z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4 7 4c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 4 0 6.1 4.2 4.6 7.7C19.5 16.4 12 21 12 21Z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 15.4 5.3 8.7l1.4-1.4 5.3 5.3 5.3-5.3 1.4 1.4z"/></svg>',
    queue: '<svg viewBox="0 0 24 24"><path d="M3 6h13v2H3zm0 5h13v2H3zm0 5h8v2H3zm15-2V8h2v6h3l-4 4-4-4h3Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    wave: '<span class="eq"><i></i><i></i><i></i></span>',
  };
  const fmt = (s) => window.StrovaPlayer ? StrovaPlayer.fmt(s) : String(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Persistent library ──
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('strova.music.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('strova.music.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const track = (v) => ({ id: v.id, title: v.title, artist: (v.uploaderName || v.artist || '').replace(/ - Topic$/, ''), artistId: v.uploaderUrl || v.artistId || '', cover: v.thumbnail || v.cover || '', duration: v.duration || 0 });

  const Library = {
    liked() { return LS.get('liked', []); },
    isLiked(id) { return Library.liked().some(t => t.id === id); },
    toggleLike(t) {
      let l = Library.liked(); const on = l.some(x => x.id === t.id);
      l = on ? l.filter(x => x.id !== t.id) : [Object.assign(track(t), { at: Date.now() }), ...l];
      LS.set('liked', l); window.dispatchEvent(new Event('strova:music-lib')); return !on;
    },
    playlists() { return LS.get('playlists', []); },
    playlist(id) { return Library.playlists().find(p => p.id === id); },
    createPlaylist(name) {
      const p = { id: 'pl' + Date.now().toString(36), name: name.trim().slice(0, 60) || 'Neue Playlist', tracks: [], at: Date.now() };
      LS.set('playlists', [p, ...Library.playlists()]); return p;
    },
    deletePlaylist(id) { LS.set('playlists', Library.playlists().filter(p => p.id !== id)); },
    addToPlaylist(id, t) {
      const all = Library.playlists(); const p = all.find(x => x.id === id); if (!p) return false;
      if (p.tracks.some(x => x.id === t.id)) return false;
      p.tracks.push(track(t)); LS.set('playlists', all); return true;
    },
    removeFromPlaylist(id, trackId) {
      const all = Library.playlists(); const p = all.find(x => x.id === id); if (!p) return;
      p.tracks = p.tracks.filter(x => x.id !== trackId); LS.set('playlists', all);
    },
    recent() { return LS.get('recent', []); },
    addRecent(t) { LS.set('recent', [track(t), ...Library.recent().filter(x => x.id !== t.id)].slice(0, 50)); },
  };

  // ── Player state ──
  const audio = new Audio();
  audio.preload = 'auto';
  let queue = [], index = -1, shuffle = LS.get('shuffle', false), repeat = LS.get('repeat', 'off'); // off | all | one
  let radio = LS.get('radio', true), loadingId = null, streamCache = new Map(), relatedCache = new Map();
  let sheetOpen = false, showQueue = false;

  // ── DOM: mini bar + sheet ──
  const bar = document.createElement('div');
  bar.className = 'mbar'; bar.hidden = true;
  bar.innerHTML = `
    <div class="mbar-progress"><i></i></div>
    <button class="mbar-main" aria-label="Läuft gerade öffnen">
      <img alt="" referrerpolicy="no-referrer"><span class="mbar-text"><b></b><small></small></span>
    </button>
    <div class="mbar-ctrl">
      <button class="m-icon m-like" aria-label="Lieblingssong">${ICON.heart}</button>
      <button class="m-icon m-prev hide-s" aria-label="Zurück">${ICON.prev}</button>
      <button class="m-icon m-play big" aria-label="Abspielen">${ICON.play}</button>
      <button class="m-icon m-next" aria-label="Weiter">${ICON.next}</button>
    </div>`;
  document.body.appendChild(bar);

  const sheet = document.createElement('section');
  sheet.className = 'msheet'; sheet.setAttribute('aria-label', 'Läuft gerade'); sheet.hidden = true;
  sheet.innerHTML = `
    <div class="msheet-bg"></div>
    <div class="msheet-inner">
      <header class="msheet-top">
        <button class="m-icon m-close" aria-label="Schließen">${ICON.down}</button>
        <span class="msheet-label">Läuft gerade</span>
        <button class="m-icon m-queue-toggle" aria-label="Warteschlange">${ICON.queue}</button>
      </header>
      <div class="msheet-body">
        <div class="msheet-art"><img alt="" referrerpolicy="no-referrer"></div>
        <div class="msheet-queue" hidden><h3>Als Nächstes</h3><ol></ol></div>
        <div class="msheet-meta">
          <div class="msheet-titles"><h2></h2><a class="msheet-artist"></a></div>
          <div style="display:flex;gap:4px">
            <button class="m-icon m-add" aria-label="Zur Playlist hinzufügen">${ICON.plus}</button>
            <button class="m-icon m-like" aria-label="Lieblingssong">${ICON.heart}</button>
          </div>
        </div>
        <div class="m-seek"><input type="range" min="0" max="1000" value="0" aria-label="Position"><div class="m-times"><span>0:00</span><span>0:00</span></div></div>
        <div class="m-controls">
          <button class="m-icon m-shuffle" aria-label="Zufallswiedergabe">${ICON.shuffle}</button>
          <button class="m-icon m-prev" aria-label="Zurück">${ICON.prev}</button>
          <button class="m-icon m-play huge" aria-label="Abspielen">${ICON.play}</button>
          <button class="m-icon m-next" aria-label="Weiter">${ICON.next}</button>
          <button class="m-icon m-repeat" aria-label="Wiederholen">${ICON.repeat}<sup></sup></button>
        </div>
        <label class="m-radio"><span class="switch"><input type="checkbox"><span></span></span> Radio: ähnliche Songs automatisch anhängen</label>
      </div>
    </div>`;
  document.body.appendChild(sheet);

  const $all = (sel) => [...bar.querySelectorAll(sel), ...sheet.querySelectorAll(sel)];
  const seek = sheet.querySelector('.m-seek input');
  const radioBox = sheet.querySelector('.m-radio input');
  radioBox.checked = radio;
  radioBox.addEventListener('change', () => { radio = radioBox.checked; LS.set('radio', radio); });

  // ── Fallback: YouTube's official embedded player (when every server is blocked) ──
  // Shown as a small visible video window above the mini bar; all controls keep working through it.
  const ytBox = document.createElement('div');
  ytBox.className = 'myt'; ytBox.hidden = true;
  ytBox.innerHTML = `<span class="myt-label">▶ YouTube-Player</span>
    <div class="myt-btns">
      <button class="myt-b" data-y="side" title="Seite wechseln" aria-label="Fenster in die andere Ecke">⇆</button>
      <button class="myt-b" data-y="size" title="Groß in der Mitte" aria-label="Groß in der Mitte anzeigen">⤢</button>
    </div>`;
  const ytShade = document.createElement('div');
  ytShade.className = 'myt-shade'; ytShade.hidden = true;
  document.body.append(ytShade, ytBox);
  const setBig = (on) => {
    ytBox.classList.toggle('big', on);
    ytShade.hidden = !on;
    const b = ytBox.querySelector('[data-y="size"]');
    b.textContent = on ? '⤡' : '⤢';
    b.title = on ? 'Verkleinern' : 'Groß in der Mitte';
  };
  ytBox.querySelector('.myt-btns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-y]'); if (!b) return;
    if (b.dataset.y === 'size') setBig(!ytBox.classList.contains('big'));
    if (b.dataset.y === 'side') ytBox.classList.toggle('left');
  });
  ytShade.addEventListener('click', () => setBig(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ytBox.classList.contains('big')) setBig(false); });
  let yt = null, ytPoll = null, mode = 'audio';

  function stopYT() {
    if (yt) { yt.destroy(); yt = null; }
    clearInterval(ytPoll); ytPoll = null;
    ytBox.hidden = true;
    ytBox.classList.remove('big'); ytShade.hidden = true;
  }
  function startYT(t) {
    stopYT();
    audio.pause(); audio.removeAttribute('src');
    mode = 'yt';
    ytBox.hidden = false;
    yt = StrovaYT.create(ytBox, {
      id: t.id,
      onState: (s) => { if (s === 1) window.dispatchEvent(new Event('strova:music-play')); renderPlayState(); if (s === 1) bar.classList.remove('loading'); },
      onEnded: () => next(true),
      onError: () => { window.toast && window.toast('„' + t.title + '“ nicht abspielbar – nächster Song'); setTimeout(() => next(true), 800); },
    });
    ytPoll = setInterval(updateTime, 500);
  }
  // One interface for both engines
  const eng = {
    paused: () => (mode === 'yt' ? !(yt && yt.playing()) : audio.paused),
    play: () => (mode === 'yt' ? yt && yt.play() : audio.play().catch(() => {})),
    pause: () => (mode === 'yt' ? yt && yt.pause() : audio.pause()),
    time: () => (mode === 'yt' ? (yt ? yt.time() : 0) : audio.currentTime),
    duration: () => (mode === 'yt' ? (yt ? yt.duration() : 0) : audio.duration),
    seek: (s) => { if (mode === 'yt') { yt && yt.seek(s); } else audio.currentTime = s; },
  };

  // ── Stream resolution ──
  async function audioUrl(id) {
    if (streamCache.has(id)) return streamCache.get(id);
    const d = await Piped.streams(id);
    const probe = document.createElement('audio');
    const streams = (d.audioStreams || []).filter(s => s.url && probe.canPlayType((s.mimeType || '').split(';')[0]))
      .sort((a, b) => {
        const am = /mp4/.test(a.mimeType) ? 1 : 0, bm = /mp4/.test(b.mimeType) ? 1 : 0;
        // prefer original language track, then highest bitrate
        const ao = a.audioTrackType === 'DUBBED' ? -1 : 0, bo = b.audioTrackType === 'DUBBED' ? -1 : 0;
        return (bo - ao) || (b.bitrate - a.bitrate) || (bm - am);
      });
    // Some instances only return a combined (video+audio) stream – an <audio> element plays just its sound.
    const muxed = (d.videoStreams || []).filter(s => s.url && !s.videoOnly && probe.canPlayType((s.mimeType || '').split(';')[0]))
      .sort((a, b) => (parseInt(a.quality) || 0) - (parseInt(b.quality) || 0));
    const urls = [...streams.map(s => s.url), ...muxed.map(s => s.url)];
    const res = { url: urls[0] || null, fallback: urls.slice(1), related: d.related, cover: d.thumbnail, duration: d.duration };
    streamCache.set(id, res);
    relatedCache.set(id, d.related || []);
    return res;
  }

  // ── Core controls ──
  const current = () => queue[index] || null;

  async function loadIndex(i, autoplay = true) {
    if (i < 0 || i >= queue.length) return;
    index = i;
    const t = queue[i];
    loadingId = t.id;
    render();
    window.dispatchEvent(new Event('strova:music-play'));
    bar.classList.add('loading');
    let s = null;
    try { s = await Promise.race([audioUrl(t.id), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]); } catch (e) { s = null; }
    if (loadingId !== t.id) return;
    if (s && s.url) {
      stopYT(); mode = 'audio';
      if (!t.duration && s.duration) t.duration = s.duration;
      audio.src = s.url;
      audio.dataset.fallback = JSON.stringify(s.fallback);
      if (autoplay) await audio.play().catch(() => {});
      bar.classList.remove('loading');
    } else {
      // every server blocked → official YouTube player
      startYT(t);
    }
    Library.addRecent(t);
    updateMediaSession();
    prefetchNext();
    if (radio && index >= queue.length - 2) extendRadio();
  }

  function prefetchNext() {
    const n = queue[index + 1];
    if (n && !streamCache.has(n.id)) audioUrl(n.id).catch(() => {});
  }

  async function extendRadio() {
    const seed = current(); if (!seed) return;
    let rel = relatedCache.get(seed.id);
    if (!rel) { try { await audioUrl(seed.id); rel = relatedCache.get(seed.id); } catch (e) { return; } }
    const have = new Set(queue.map(t => t.id));
    const add = (rel || []).filter(v => !have.has(v.id) && v.duration > 60 && v.duration < 900).slice(0, 8).map(track);
    if (add.length) { queue.push(...add); renderQueue(); }
  }

  function play(list, startIndex = 0) {
    const tracks = list.map(track);
    if (shuffle && tracks.length > 1) {
      const first = tracks.splice(startIndex, 1)[0];
      for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
      queue = [first, ...tracks]; startIndex = 0;
    } else queue = tracks;
    bar.hidden = false;
    document.body.classList.add('has-mbar');
    loadIndex(startIndex);
  }
  function playNext(t) {
    if (!queue.length) return play([t]);
    queue.splice(index + 1, 0, track(t)); renderQueue();
    window.toast && window.toast('Spielt als Nächstes');
  }
  function addToQueue(t) {
    if (!queue.length) return play([t]);
    queue.push(track(t)); renderQueue();
    window.toast && window.toast('Zur Warteschlange hinzugefügt');
  }
  function toggle() {
    if (!current()) return;
    if (eng.paused()) { window.dispatchEvent(new Event('strova:music-play')); eng.play(); } else eng.pause();
  }
  function next(auto) {
    if (!queue.length) return;
    if (auto && repeat === 'one') { eng.seek(0); eng.play(); return; }
    if (index + 1 < queue.length) loadIndex(index + 1);
    else if (repeat === 'all') loadIndex(0);
    else if (radio) { extendRadio().then(() => { if (index + 1 < queue.length) loadIndex(index + 1); }); }
  }
  function prev() {
    if (eng.time() > 4 || index === 0) { eng.seek(0); return; }
    loadIndex(index - 1);
  }

  // ── Rendering ──
  function render() {
    const t = current(); if (!t) return;
    const big = window.Piped ? Piped.maxThumb(t.cover) : t.cover;
    const mini = bar.querySelector('.mbar-main img'), art = sheet.querySelector('.msheet-art img');
    if (mini.dataset.for !== t.id) { mini.dataset.for = t.id; mini.src = t.cover; }
    if (art.dataset.for !== t.id) { art.dataset.for = t.id; art.src = big; }
    bar.querySelector('.mbar-text b').textContent = t.title;
    bar.querySelector('.mbar-text small').textContent = t.artist;
    sheet.querySelector('.msheet-titles h2').textContent = t.title;
    const a = sheet.querySelector('.msheet-artist');
    a.textContent = t.artist; a.href = t.artistId ? '#/channel/' + t.artistId : '#/music';
    sheet.querySelector('.msheet-bg').style.backgroundImage = `url("${t.cover.replace(/"/g, '')}")`;
    if ('mediaSession' in navigator && navigator.mediaSession.metadata) navigator.mediaSession.metadata.artwork = [{ src: big, sizes: '1280x720' }];
    const liked = Library.isLiked(t.id);
    $all('.m-like').forEach(b => { b.classList.toggle('on', liked); b.setAttribute('aria-pressed', liked); });
    $all('.m-shuffle').forEach(b => b.classList.toggle('on', shuffle));
    $all('.m-repeat').forEach(b => { b.classList.toggle('on', repeat !== 'off'); b.querySelector('sup').textContent = repeat === 'one' ? '1' : ''; });
    renderPlayState();
    renderQueue();
    document.querySelectorAll('[data-track-id]').forEach(el => el.classList.toggle('playing', el.dataset.trackId === t.id));
  }
  function renderPlayState() {
    const playing = !eng.paused();
    $all('.m-play').forEach(b => { b.innerHTML = playing ? ICON.pause : ICON.play; b.setAttribute('aria-label', playing ? 'Pause' : 'Abspielen'); });
    sheet.classList.toggle('is-playing', playing);
    document.body.classList.toggle('music-playing', playing);
  }
  function renderQueue() {
    const ol = sheet.querySelector('.msheet-queue ol');
    if (!showQueue) return;
    ol.innerHTML = queue.map((t, i) => `<li class="${i === index ? 'now' : ''} ${i < index ? 'past' : ''}" data-i="${i}">
      <img src="${esc(t.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span>
      ${i === index ? ICON.wave : `<button class="m-icon small" data-rm="${i}" aria-label="Entfernen">✕</button>`}</li>`).join('');
    const now = ol.querySelector('.now'); if (now) now.scrollIntoView({ block: 'nearest' });
  }
  function updateTime() {
    const d = eng.duration() || (current() && current().duration) || 0;
    const p = d ? eng.time() / d : 0;
    bar.querySelector('.mbar-progress i').style.width = p * 100 + '%';
    if (!seek.dragging) seek.value = Math.round(p * 1000);
    seek.style.setProperty('--p', p * 100 + '%');
    const times = sheet.querySelectorAll('.m-times span');
    times[0].textContent = fmt(eng.time()); times[1].textContent = fmt(d);
  }
  function updateMediaSession() {
    const t = current(); if (!t || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: 'Strova Musik', artwork: [{ src: t.cover, sizes: '512x512' }] });
      navigator.mediaSession.setActionHandler('play', toggle);
      navigator.mediaSession.setActionHandler('pause', toggle);
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('seekto', (e) => { eng.seek(e.seekTime); });
    } catch (e) {}
  }

  function openSheet() { sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); sheetOpen = true; document.body.classList.add('sheet-open'); }
  function closeSheet() { sheet.classList.remove('open'); sheetOpen = false; document.body.classList.remove('sheet-open'); setTimeout(() => { if (!sheetOpen) sheet.hidden = true; }, 350); }

  // ── Events ──
  audio.addEventListener('play', renderPlayState);
  audio.addEventListener('pause', renderPlayState);
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('error', () => {
    if (mode === 'yt' || !audio.getAttribute('src')) return;
    let fb = []; try { fb = JSON.parse(audio.dataset.fallback || '[]'); } catch (e) {}
    if (fb.length) { audio.dataset.fallback = JSON.stringify(fb.slice(1)); audio.src = fb[0]; audio.play().catch(() => {}); }
    else if (current()) { window.toast && window.toast('Stream-Fehler – nächster Song'); setTimeout(() => next(true), 600); }
  });

  bar.querySelector('.mbar-main').addEventListener('click', openSheet);
  sheet.querySelector('.m-close').addEventListener('click', closeSheet);
  sheet.querySelector('.msheet-artist').addEventListener('click', closeSheet);
  sheet.querySelector('.m-queue-toggle').addEventListener('click', (e) => {
    showQueue = !showQueue;
    e.currentTarget.classList.toggle('on', showQueue);
    sheet.querySelector('.msheet-queue').hidden = !showQueue;
    sheet.querySelector('.msheet-art').hidden = showQueue;
    renderQueue();
  });
  sheet.querySelector('.msheet-queue ol').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { const i = +rm.dataset.rm; queue.splice(i, 1); if (i < index) index--; renderQueue(); return; }
    const li = e.target.closest('li'); if (li) loadIndex(+li.dataset.i);
  });
  $all('.m-play').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); }));
  $all('.m-next').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); next(); }));
  $all('.m-prev').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); prev(); }));
  $all('.m-like').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); const t = current(); if (!t) return;
    const on = Library.toggleLike(t); render();
    if (on) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
    window.toast && window.toast(on ? '❤️ Zu Lieblingssongs hinzugefügt' : 'Aus Lieblingssongs entfernt');
  }));
  $all('.m-shuffle').forEach(b => b.addEventListener('click', () => {
    shuffle = !shuffle; LS.set('shuffle', shuffle);
    if (shuffle && queue.length > 2) {
      const rest = queue.splice(index + 1);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      queue.push(...rest);
    }
    render();
  }));
  $all('.m-repeat').forEach(b => b.addEventListener('click', () => {
    repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; LS.set('repeat', repeat); render();
    window.toast && window.toast({ off: 'Wiederholen aus', all: 'Alle wiederholen', one: 'Song wiederholen' }[repeat]);
  }));
  sheet.querySelector('.m-add').addEventListener('click', () => { const t = current(); if (t) Music.pickPlaylist(t); });
  seek.addEventListener('input', () => { seek.dragging = true; const d = eng.duration() || 0; sheet.querySelector('.m-times span').textContent = fmt(d * seek.value / 1000); seek.style.setProperty('--p', seek.value / 10 + '%'); });
  seek.addEventListener('change', () => { const d = eng.duration() || 0; eng.seek(d * seek.value / 1000); seek.dragging = false; });

  // swipe down to close the sheet on phones
  let startY = null;
  sheet.addEventListener('touchstart', (e) => { if (e.target.closest('input, .msheet-queue')) return; startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', (e) => { if (startY == null) return; const dy = e.touches[0].clientY - startY; if (dy > 0) sheet.querySelector('.msheet-inner').style.transform = `translateY(${dy}px)`; }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = e.changedTouches[0].clientY - startY; startY = null;
    sheet.querySelector('.msheet-inner').style.transform = '';
    if (dy > 120) closeSheet();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });

  // pause music when a video starts, and vice versa
  window.addEventListener('strova:video-play', () => { if (!eng.paused()) eng.pause(); });
  window.addEventListener('strova:music-lib', render);
  window.addEventListener('hashchange', () => { if (sheetOpen) closeSheet(); });

  const Music = {
    ICON, Library, track,
    play, playNext, addToQueue, toggle,
    current: () => current(),
    isPlaying: () => !eng.paused(),
    /** Simple dialog to pick or create a playlist for a track */
    pickPlaylist(t) {
      const lists = Library.playlists();
      const dlg = document.createElement('div');
      dlg.className = 'mdialog';
      dlg.innerHTML = `<div class="mdialog-box" role="dialog" aria-label="Zur Playlist hinzufügen">
        <h3>Zur Playlist hinzufügen</h3>
        <form class="mdialog-new"><input placeholder="Neue Playlist …" maxlength="60" aria-label="Name der neuen Playlist"><button class="btn primary">Erstellen</button></form>
        <div class="mdialog-list">${lists.map(p => `<button data-id="${p.id}"><span class="pl-cover sm">${p.tracks[0] ? `<img src="${esc(p.tracks[0].cover)}" alt="" referrerpolicy="no-referrer">` : '🎵'}</span><span><b>${esc(p.name)}</b><small>${p.tracks.length} Songs</small></span></button>`).join('') || '<p class="sub">Noch keine Playlists.</p>'}</div>
        <button class="btn mdialog-close">Abbrechen</button></div>`;
      document.body.appendChild(dlg);
      const close = () => dlg.remove();
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.mdialog-close')) close(); });
      dlg.querySelector('.mdialog-list').addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]'); if (!b) return;
        const ok = Library.addToPlaylist(b.dataset.id, t);
        window.toast && window.toast(ok ? 'Hinzugefügt' : 'Ist schon in der Playlist'); close();
      });
      dlg.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dlg.querySelector('input').value; if (!name.trim()) return;
        const p = Library.createPlaylist(name); Library.addToPlaylist(p.id, t);
        window.toast && window.toast('Playlist „' + p.name + '“ erstellt'); close();
      });
      setTimeout(() => dlg.querySelector('input').focus(), 50);
    },
  };
  window.Music = Music;
})();
