/* Strova – fallback to YouTube's official embedded player (IFrame Player API).
   Used when no Piped/Invidious server can deliver a stream (e.g. YouTube blocks them).
   The player stays visible, as YouTube's embed terms require. */
(function () {
  let apiPromise = null;

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('YouTube-Player konnte nicht geladen werden')); };
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden des YouTube-Players')), 15000);
    });
    return apiPromise;
  }

  const ERRORS = {
    2: 'Ungültige Video-ID.',
    5: 'Dieses Video kann im eingebetteten Player nicht abgespielt werden.',
    100: 'Das Video wurde entfernt oder ist privat.',
    101: 'Der Uploader erlaubt das Abspielen außerhalb von YouTube nicht.',
    150: 'Der Uploader erlaubt das Abspielen außerhalb von YouTube nicht.',
    153: 'Der YouTube-Player hat die Anfrage abgelehnt.',
  };

  /**
   * Creates an embedded player inside `host`.
   * opts: { id, start, autoplay, onState(state), onEnded(), onError(msg), onReady(player) }
   * Returns a controller with play/pause/seek/time/duration/destroy.
   */
  function create(host, opts) {
    const box = document.createElement('div');
    box.className = 'yt-embed';
    // Build the iframe ourselves so it can send a referrer (embeds refuse to play without one – error 153);
    // the app page itself stays on no-referrer for privacy.
    const params = new URLSearchParams({
      enablejsapi: '1', autoplay: opts.autoplay === false ? '0' : '1', start: String(Math.floor(opts.start || 0)),
      rel: '0', playsinline: '1', modestbranding: '1', hl: 'de', cc_lang_pref: 'de',
    });
    if (/^https?:$/.test(location.protocol)) params.set('origin', location.origin);
    const target = document.createElement('iframe');
    target.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(opts.id)}?${params}`;
    target.referrerPolicy = 'strict-origin-when-cross-origin';
    target.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    target.allowFullscreen = true;
    target.title = 'YouTube-Player';
    box.appendChild(target);
    host.appendChild(box);
    let player = null, destroyed = false, ready = false;
    const ctl = {
      el: box,
      get ready() { return ready; },
      play() { player && player.playVideo && player.playVideo(); },
      pause() { player && player.pauseVideo && player.pauseVideo(); },
      seek(t) { player && player.seekTo && player.seekTo(t, true); },
      time() { return player && player.getCurrentTime ? player.getCurrentTime() || 0 : 0; },
      duration() { return player && player.getDuration ? player.getDuration() || 0 : 0; },
      playing() { return !!(player && player.getPlayerState && player.getPlayerState() === 1); },
      setVolume(v) { player && player.setVolume && player.setVolume(Math.round(v * 100)); },
      destroy() { destroyed = true; try { player && player.destroy(); } catch (e) {} box.remove(); },
    };
    loadApi().then((YT) => {
      if (destroyed) return;
      player = new YT.Player(target, {
        events: {
          onReady: () => {
            ready = true;
            if (opts.autoplay !== false) player.playVideo();
            if (opts.onReady) opts.onReady(ctl);
          },
          onStateChange: (e) => {
            if (opts.onState) opts.onState(e.data);
            if (e.data === 0 && opts.onEnded) opts.onEnded();
          },
          onError: (e) => { if (opts.onError) opts.onError(ERRORS[e.data] || 'Wiedergabefehler (' + e.data + ')'); },
        },
      });
    }).catch((e) => { if (opts.onError) opts.onError(e.message); });
    return ctl;
  }

  window.StrovaYT = { create, loadApi };
})();
