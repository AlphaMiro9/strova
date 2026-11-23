/* Strova – custom video player (HLS via hls.js, progressive MP4 fallback) */
(function () {
  const I = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l10.8-6.9a1 1 0 0 0 0-1.7L9.5 4.2A1 1 0 0 0 8 5.1Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z"/><text x="12" y="16.3" font-size="6.5" font-weight="700" text-anchor="middle" font-family="sans-serif">10</text></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8Z"/><text x="12" y="16.3" font-size="6.5" font-weight="700" text-anchor="middle" font-family="sans-serif">10</text></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4Zm12.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4Zm16.6 3 2.1-2.1-1.4-1.4-2.1 2.1-2.1-2.1-1.4 1.4 2.1 2.1-2.1 2.1 1.4 1.4 2.1-2.1 2.1 2.1 1.4-1.4L20.6 12Z"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1Zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1Z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6Zm4 8V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2Zm-2 0H3V5h18v14Z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2V5Zm9-2v2h5v5h2V3h-7Zm5 16h-5v2h7v-7h-2v5ZM5 14H3v7h7v-2H5v-5Z"/></svg>',
    exitFull: '<svg viewBox="0 0 24 24"><path d="M8 8H3v2h7V3H8v5Zm8 0V3h-2v7h7V8h-5Zm-2 13h2v-5h5v-2h-7v7ZM3 16h5v5h2v-7H3v2Z"/></svg>',
  };
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3];

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  }

  /**
   * @param {HTMLElement} host
   * @param {object} opts { data (Piped streams), startAt, autoplay, onEnded }
   */
  function create(host, opts) {
    const data = opts.data;
    const settings = Store.settings();
    const el = document.createElement('div');
    el.className = 'player loading';
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Videoplayer');
    el.innerHTML = `
      <video playsinline webkit-playsinline preload="metadata"${Piped.backend() === 'piped' ? ' crossorigin="anonymous"' : ''}></video>
      <div class="p-center"><div class="p-spinner"></div><div class="p-big"></div></div>
      <div class="p-seekhint left">« 10 s</div><div class="p-seekhint right">10 s »</div>
      <div class="p-overlay">
        <div class="p-bar">
          <div class="p-progress" role="slider" aria-label="Position" tabindex="0">
            <div class="p-track"><div class="p-buf"></div><div class="p-played"></div></div>
            <div class="p-knob"></div><div class="p-tip">0:00</div>
          </div>
          <div class="p-controls">
            <button class="p-btn" data-a="play" aria-label="Abspielen">${I.play}</button>
            <button class="p-btn" data-a="back" aria-label="10 Sekunden zurück">${I.back}</button>
            <button class="p-btn" data-a="fwd" aria-label="10 Sekunden vor">${I.fwd}</button>
            <div class="p-volwrap">
              <button class="p-btn" data-a="mute" aria-label="Ton aus">${I.vol}</button>
              <input class="p-vol" type="range" min="0" max="1" step="0.02" aria-label="Lautstärke">
            </div>
            <span class="p-time">0:00 / 0:00</span>
            <span class="p-spacer"></span>
            <button class="p-btn" data-a="cc" aria-label="Untertitel" hidden>${I.cc}</button>
            <button class="p-btn" data-a="settings" aria-label="Einstellungen">${I.gear}</button>
            <button class="p-btn" data-a="pip" aria-label="Bild im Bild">${I.pip}</button>
            <button class="p-btn" data-a="full" aria-label="Vollbild">${I.full}</button>
          </div>
        </div>
      </div>`;
    host.appendChild(el);

    const $ = (s) => el.querySelector(s);
    const video = $('video');
    const big = $('.p-big');
    const progress = $('.p-progress');
    const played = $('.p-played'), buf = $('.p-buf'), knob = $('.p-knob'), tip = $('.p-tip');
    const timeEl = $('.p-time');
    const btn = (a) => el.querySelector(`[data-a="${a}"]`);
    let hls = null, menu = null, hideTimer = null, destroyed = false, saveTimer = null;
    let currentSource = null, hlsLevel = -1, activeCaption = -1;

    // ── Sources ──
    const progressive = data.videoStreams
      .filter(s => !s.videoOnly && s.url && /mp4|webm/i.test(s.mimeType || s.format || ''))
      .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    const sources = [];
    if (data.hls) sources.push({ kind: 'hls', label: 'Auto', url: data.hls });
    progressive.forEach(s => sources.push({ kind: 'file', label: s.quality + (/webm/i.test(s.mimeType) ? ' (WebM)' : ''), url: s.url }));
    const canHlsJs = window.Hls && Hls.isSupported();
    const canNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl');

    function pickInitial() {
      const hlsSrc = sources.find(s => s.kind === 'hls');
      const want = parseInt(settings.defaultQuality) || 0;
      if (want && !data.live) {
        const files = sources.filter(s => s.kind === 'file');
        const fit = files.find(s => (parseInt(s.label) || 0) <= want) || files[files.length - 1];
        if (fit) return fit;
      }
      if (hlsSrc && (canHlsJs || canNativeHls) && (settings.preferHls || !progressive.length || data.live)) return hlsSrc;
      return sources.find(s => s.kind === 'file') || hlsSrc || null;
    }

    function load(src, at, autoplay) {
      if (hls) { hls.destroy(); hls = null; }
      currentSource = src;
      el.classList.add('loading');
      removeError();
      if (src.kind === 'hls' && canHlsJs) {
        hls = new Hls({ startPosition: at || -1, capLevelToPlayerSize: true, maxBufferLength: 30 });
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          fallback(video.currentTime);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (autoplay) playSafe(); });
        hls.loadSource(src.url);
        hls.attachMedia(video);
      } else {
        video.src = src.url;
        if (at) video.addEventListener('loadedmetadata', () => { video.currentTime = at; }, { once: true });
        if (autoplay) playSafe();
      }
    }
    function fallback(at) {
      const idx = sources.indexOf(currentSource);
      const next = sources.slice(idx + 1).find(s => s.kind === 'file');
      if (next) { toastMsg('Wechsle auf ' + next.label); load(next, at, true); }
      else showError('Video kann nicht abgespielt werden', 'Der Server hat den Stream abgelehnt. Wähle in den Einstellungen eine andere Instanz.');
    }
    function playSafe() {
      const p = video.play();
      if (p && p.catch) p.catch(() => { el.classList.remove('loading'); showUi(); });
    }

    // ── Captions ──
    const subs = (data.subtitles || []).filter(s => s.url && /vtt/i.test(s.mimeType || s.url));
    subs.forEach((s, i) => {
      const t = document.createElement('track');
      t.kind = 'subtitles'; t.label = s.name + (s.autoGenerated ? ' (auto)' : ''); t.srclang = s.code || 'xx'; t.src = s.url;
      video.appendChild(t);
      t.track.mode = 'disabled';
      t.dataset.i = i;
    });
    if (subs.length) btn('cc').hidden = false;
    function setCaption(i) {
      activeCaption = i;
      [...video.textTracks].forEach((t, j) => { t.mode = j === i ? 'showing' : 'disabled'; });
      btn('cc').classList.toggle('on', i >= 0);
    }
    function defaultCaption() {
      const lang = (navigator.language || 'de').slice(0, 2);
      let i = subs.findIndex(s => s.code && s.code.startsWith(lang) && !s.autoGenerated);
      if (i < 0) i = subs.findIndex(s => s.code && s.code.startsWith(lang));
      return i < 0 ? 0 : i;
    }

    // ── UI state ──
    function flash(icon) {
      big.innerHTML = icon; big.classList.remove('flash'); void big.offsetWidth; big.classList.add('flash');
      clearTimeout(flash.t); flash.t = setTimeout(() => big.classList.remove('flash'), 450);
    }
    function showUi() {
      el.classList.remove('hide-ui');
      clearTimeout(hideTimer);
      if (!video.paused && !menu) hideTimer = setTimeout(() => el.classList.add('hide-ui'), 2600);
    }
    function togglePlay() {
      if (video.paused) { playSafe(); flash(I.play); } else { video.pause(); flash(I.pause); }
    }
    function seekBy(sec) {
      video.currentTime = Math.max(0, Math.min((video.duration || 0), video.currentTime + sec));
      const hint = el.querySelector(sec < 0 ? '.p-seekhint.left' : '.p-seekhint.right');
      hint.classList.add('show'); clearTimeout(hint.t); hint.t = setTimeout(() => hint.classList.remove('show'), 600);
      showUi();
    }
    function updateTime() {
      const d = video.duration, t = video.currentTime;
      const pct = d ? (t / d) * 100 : 0;
      played.style.width = pct + '%'; knob.style.left = pct + '%';
      timeEl.textContent = data.live && !isFinite(d) ? '● LIVE' : `${fmt(t)} / ${fmt(d)}`;
      progress.setAttribute('aria-valuenow', Math.floor(t));
    }
    function updateBuffer() {
      const d = video.duration;
      if (!d || !video.buffered.length) return;
      let end = 0;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime + 1) end = video.buffered.end(i);
      buf.style.width = (end / d) * 100 + '%';
    }
    function updateVolume() {
      btn('mute').innerHTML = video.muted || video.volume === 0 ? I.mute : I.vol;
      $('.p-vol').value = video.muted ? 0 : video.volume;
    }
    function showError(title, text) {
      removeError();
      el.classList.remove('loading');
      const e = document.createElement('div');
      e.className = 'p-error'; e.innerHTML = `<div><b></b><span></span></div>`;
      e.querySelector('b').textContent = title; e.querySelector('span').textContent = text;
      el.appendChild(e);
    }
    function removeError() { const e = el.querySelector('.p-error'); if (e) e.remove(); }
    function toastMsg(t) { if (window.toast) window.toast(t); }

    // ── Progress dragging ──
    function posFromEvent(ev) {
      const r = progress.getBoundingClientRect();
      return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    }
    function showTip(p) {
      tip.textContent = fmt(p * (video.duration || 0));
      tip.style.left = Math.max(20, Math.min(progress.clientWidth - 20, p * progress.clientWidth)) + 'px';
    }
    progress.addEventListener('pointermove', (ev) => showTip(posFromEvent(ev)));
    progress.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      progress.setPointerCapture(ev.pointerId);
      progress.classList.add('drag');
      const move = (e) => {
        const p = posFromEvent(e); showTip(p);
        played.style.width = knob.style.left = p * 100 + '%';
        if (video.duration) video.currentTime = p * video.duration;
      };
      move(ev);
      const up = () => { progress.classList.remove('drag'); progress.removeEventListener('pointermove', move); progress.removeEventListener('pointerup', up); progress.removeEventListener('pointercancel', up); };
      progress.addEventListener('pointermove', move);
      progress.addEventListener('pointerup', up);
      progress.addEventListener('pointercancel', up);
    });
    progress.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { seekBy(-5); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowRight') { seekBy(5); e.preventDefault(); e.stopPropagation(); }
    });

    // ── Menu ──
    function closeMenu() { if (menu) { menu.remove(); menu = null; showUi(); } }
    function openMenu(kind) {
      if (menu) { const same = menu.dataset.kind === kind; closeMenu(); if (same) return; }
      menu = document.createElement('div');
      menu.className = 'p-menu'; menu.dataset.kind = kind;
      const add = (label, sel, fn, right) => {
        const b = document.createElement('button');
        b.textContent = label; if (sel) b.className = 'sel';
        if (right) { const s = document.createElement('small'); s.textContent = right; s.style.opacity = .6; b.appendChild(s); }
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        menu.appendChild(b);
      };
      const head = (t) => { const h = document.createElement('h4'); h.textContent = t; menu.appendChild(h); };
      if (kind === 'settings') {
        head('Geschwindigkeit');
        SPEEDS.forEach(s => add(s === 1 ? 'Normal' : s + '×', video.playbackRate === s, () => { video.playbackRate = s; closeMenu(); }));
        head('Qualität');
        if (hls && hls.levels && hls.levels.length) {
          add('Auto', hlsLevel === -1, () => { hlsLevel = -1; hls.currentLevel = -1; closeMenu(); }, hls.currentLevel >= 0 && hls.levels[hls.currentLevel] ? hls.levels[hls.currentLevel].height + 'p' : '');
          hls.levels.map((l, i) => ({ l, i })).sort((a, b) => b.l.height - a.l.height)
            .forEach(({ l, i }) => add(l.height + 'p' + (l.frameRate > 30 ? Math.round(l.frameRate) : ''), hlsLevel === i, () => { hlsLevel = i; hls.currentLevel = i; closeMenu(); }));
        } else if (currentSource && currentSource.kind === 'hls') {
          add('Auto', true, closeMenu);
        }
        sources.filter(s => s.kind === 'file').forEach(s => add(s.label + ' · MP4', currentSource === s, () => {
          const at = video.currentTime, wasPaused = video.paused; closeMenu(); load(s, at, !wasPaused);
        }));
        if (currentSource && currentSource.kind === 'file' && sources[0] && sources[0].kind === 'hls' && (canHlsJs || canNativeHls)) {
          add('Adaptiv (HLS)', false, () => { const at = video.currentTime; closeMenu(); load(sources[0], at, true); });
        }
      } else if (kind === 'cc') {
        head('Untertitel');
        add('Aus', activeCaption < 0, () => { setCaption(-1); Store.setSetting('captions', false); closeMenu(); });
        subs.forEach((s, i) => add(s.name + (s.autoGenerated ? ' (automatisch)' : ''), activeCaption === i, () => { setCaption(i); Store.setSetting('captions', true); closeMenu(); }));
      }
      el.appendChild(menu);
      clearTimeout(hideTimer);
      el.classList.remove('hide-ui');
    }

    // ── Buttons ──
    el.querySelector('.p-controls').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      e.stopPropagation();
      switch (b.dataset.a) {
        case 'play': togglePlay(); break;
        case 'back': seekBy(-10); break;
        case 'fwd': seekBy(10); break;
        case 'mute': video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = .5; break;
        case 'cc': subs.length === 1 ? (setCaption(activeCaption < 0 ? 0 : -1)) : openMenu('cc'); break;
        case 'settings': openMenu('settings'); break;
        case 'pip': togglePip(); break;
        case 'full': toggleFull(); break;
      }
    });
    $('.p-vol').addEventListener('input', (e) => { video.volume = +e.target.value; video.muted = video.volume === 0; });
    $('.p-vol').addEventListener('click', e => e.stopPropagation());

    async function togglePip() {
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (video.requestPictureInPicture) await video.requestPictureInPicture();
        else if (video.webkitSetPresentationMode) video.webkitSetPresentationMode('picture-in-picture');
      } catch (e) { toastMsg('Bild im Bild ist hier nicht verfügbar'); }
    }
    async function toggleFull() {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else if (el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: 'hide' });
          if (screen.orientation && screen.orientation.lock && video.videoWidth > video.videoHeight) screen.orientation.lock('landscape').catch(() => {});
        } else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch (e) { /* ignore */ }
    }
    const onFs = () => { btn('full').innerHTML = (document.fullscreenElement === el) ? I.exitFull : I.full; };
    document.addEventListener('fullscreenchange', onFs);
    if (!document.pictureInPictureEnabled && !video.webkitSetPresentationMode) btn('pip').hidden = true;

    // ── Gestures: click / tap / double-tap ──
    let lastTap = 0, tapTimer = null;
    el.addEventListener('pointerup', (e) => {
      if (e.target.closest('.p-bar, .p-menu, .p-error')) return;
      if (menu) { closeMenu(); return; }
      const now = Date.now();
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const touch = e.pointerType !== 'mouse';
      if (now - lastTap < 300) {
        clearTimeout(tapTimer); lastTap = 0;
        if (x < 0.35) seekBy(-10);
        else if (x > 0.65) seekBy(10);
        else toggleFull();
        return;
      }
      lastTap = now;
      tapTimer = setTimeout(() => {
        if (!touch) togglePlay();
        else if (el.classList.contains('hide-ui')) showUi();
        else if (x > 0.35 && x < 0.65) togglePlay();
        else if (!video.paused) el.classList.add('hide-ui');
      }, touch ? 260 : 200);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showUi(); });
    el.addEventListener('mouseleave', () => { if (!video.paused && !menu) el.classList.add('hide-ui'); });

    // ── Keyboard ──
    function onKey(e) {
      if (destroyed) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
      const k = e.key;
      const handled = true;
      if (k === ' ' || k === 'k' || k === 'K') togglePlay();
      else if (k === 'j' || k === 'J' || k === 'ArrowLeft') seekBy(k === 'ArrowLeft' ? -5 : -10);
      else if (k === 'l' || k === 'L' || k === 'ArrowRight') seekBy(k === 'ArrowRight' ? 5 : 10);
      else if (k === 'ArrowUp') { video.volume = Math.min(1, video.volume + .05); video.muted = false; showUi(); }
      else if (k === 'ArrowDown') { video.volume = Math.max(0, video.volume - .05); showUi(); }
      else if (k === 'm' || k === 'M') video.muted = !video.muted;
      else if (k === 'f' || k === 'F') toggleFull();
      else if (k === 'i' || k === 'I') togglePip();
      else if ((k === 'c' || k === 'C') && subs.length) setCaption(activeCaption < 0 ? defaultCaption() : -1);
      else if (k === '>' || k === '<') {
        const i = SPEEDS.indexOf(video.playbackRate);
        const n = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 3 : i) + (k === '>' ? 1 : -1)))];
        video.playbackRate = n; toastMsg('Geschwindigkeit ' + n + '×');
      } else if (/^[0-9]$/.test(k) && video.duration) video.currentTime = video.duration * (+k / 10);
      else if (k === 'Escape' && menu) closeMenu();
      else return;
      if (handled) e.preventDefault();
    }
    document.addEventListener('keydown', onKey);

    // ── Video events ──
    const onMusic = () => { if (!video.paused) video.pause(); };
    window.addEventListener('strova:music-play', onMusic);
    video.addEventListener('play', () => { window.dispatchEvent(new Event('strova:video-play')); btn('play').innerHTML = I.pause; btn('play').setAttribute('aria-label', 'Pause'); showUi(); });
    video.addEventListener('pause', () => { btn('play').innerHTML = I.play; btn('play').setAttribute('aria-label', 'Abspielen'); showUi(); savePos(); });
    video.addEventListener('waiting', () => el.classList.add('loading'));
    video.addEventListener('playing', () => el.classList.remove('loading'));
    video.addEventListener('canplay', () => el.classList.remove('loading'));
    video.addEventListener('loadedmetadata', () => { progress.setAttribute('aria-valuemax', Math.floor(video.duration || 0)); updateTime(); });
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('progress', updateBuffer);
    video.addEventListener('volumechange', () => { updateVolume(); try { localStorage.setItem('strova.volume', JSON.stringify({ v: video.volume, m: video.muted })); } catch (e) {} });
    video.addEventListener('ratechange', () => Store.setSetting('defaultSpeed', video.playbackRate));
    video.addEventListener('ended', () => { Store.setPosition(data.id, 0, 0); if (opts.onEnded) opts.onEnded(); });
    video.addEventListener('error', () => {
      if (hls) return; // handled by hls.js
      fallback(video.currentTime);
    });

    function savePos() { if (Store.settings().resume && !data.live) Store.setPosition(data.id, video.currentTime, video.duration); }
    saveTimer = setInterval(() => { if (!video.paused) savePos(); }, 5000);

    // restore volume & speed
    try { const v = JSON.parse(localStorage.getItem('strova.volume') || 'null'); if (v) { video.volume = v.v; video.muted = v.m; } } catch (e) {}
    video.playbackRate = settings.defaultSpeed || 1;
    video.defaultPlaybackRate = 1;
    updateVolume();
    if (data.thumbnail) video.poster = data.thumbnail;

    // ── Media Session (lock screen / media keys) ──
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: data.title, artist: data.uploaderName, artwork: data.thumbnail ? [{ src: data.thumbnail, sizes: '480x360' }] : [] });
        navigator.mediaSession.setActionHandler('play', () => playSafe());
        navigator.mediaSession.setActionHandler('pause', () => video.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
        navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
        navigator.mediaSession.setActionHandler('nexttrack', opts.onEnded ? () => opts.onEnded(true) : null);
      } catch (e) {}
    }

    // ── SponsorBlock: skip sponsor / intro segments (community data from sponsor.ajay.app) ──
    const SB_NAMES = { sponsor: 'Sponsor', selfpromo: 'Eigenwerbung', interaction: 'Abo-Erinnerung', intro: 'Intro', outro: 'Abspann', preview: 'Vorschau', music_offtopic: 'Nicht-Musik', filler: 'Füller' };
    let segments = [];
    if (settings.sponsorBlock && !data.live && (settings.sbCategories || []).length) {
      const cats = encodeURIComponent(JSON.stringify(settings.sbCategories));
      fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(data.id)}&categories=${cats}`, { referrerPolicy: 'no-referrer' })
        .then(r => (r.ok ? r.json() : []))
        .then(list => {
          if (destroyed || !Array.isArray(list)) return;
          segments = list.filter(s => s.actionType !== 'full' && s.segment[1] - s.segment[0] > 1)
            .map(s => ({ start: s.segment[0], end: s.segment[1], cat: s.category, done: false }));
          drawSegments();
        }).catch(() => {});
    }
    function drawSegments() {
      const d = video.duration || data.duration;
      if (!d || !segments.length) return;
      el.querySelectorAll('.p-seg').forEach(x => x.remove());
      const track = el.querySelector('.p-track');
      segments.forEach(s => {
        const m = document.createElement('div');
        m.className = 'p-seg';
        m.style.left = (s.start / d) * 100 + '%'; m.style.width = ((s.end - s.start) / d) * 100 + '%';
        track.appendChild(m);
      });
    }
    video.addEventListener('loadedmetadata', drawSegments);
    video.addEventListener('timeupdate', () => {
      if (!segments.length || video.paused) return;
      const t = video.currentTime;
      for (const s of segments) {
        if (!s.done && t >= s.start && t < s.end - 0.5) {
          s.done = true;
          video.currentTime = s.end;
          toastMsg('⏭ ' + (SB_NAMES[s.cat] || 'Abschnitt') + ' übersprungen');
          break;
        }
      }
    });
    video.addEventListener('seeked', () => { segments.forEach(s => { if (video.currentTime < s.start) s.done = false; }); });

    // ── Start ──
    const first = pickInitial();
    if (!first) showError('Keine abspielbaren Streams', data.live ? 'Livestreams werden von dieser Instanz nicht unterstützt.' : 'Probiere eine andere Instanz in den Einstellungen.');
    else load(first, opts.startAt || 0, opts.autoplay !== false);
    if (settings.captions && subs.length) setCaption(defaultCaption());

    return {
      el, video,
      seek(t) { video.currentTime = t; playSafe(); },
      destroy() {
        destroyed = true;
        savePos();
        clearInterval(saveTimer); clearTimeout(hideTimer);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('fullscreenchange', onFs);
        window.removeEventListener('strova:music-play', onMusic);
        if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
        if (hls) hls.destroy();
        video.removeAttribute('src'); video.load();
        el.remove();
      },
    };
  }

  window.StrovaPlayer = { create, fmt };
})();
