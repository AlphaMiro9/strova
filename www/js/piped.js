/* Strova – video backend client: Piped or Invidious, with automatic instance fallback.
   Both backends are normalised into the same shapes, so the rest of the app doesn't care which is used. */
(function () {
  const FALLBACK = {
    piped: [
      'https://api.piped.private.coffee',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://pipedapi.leptons.xyz',
      'https://pipedapi.nosebs.ru',
      'https://pipedapi.reallyaweso.me',
      'https://piped-api.lunar.icu',
      'https://pipedapi.drgns.space',
    ],
    invidious: [
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yewtu.be',
      'https://invidious.f5.si',
      'https://inv.tux.pizza',
      'https://invidious.privacyredirect.com',
    ],
  };
  const instanceLists = {};

  const backend = () => (Store.settings().backend === 'invidious' ? 'invidious' : 'piped');
  const baseOf = (b) => (b === 'invidious' ? Store.settings().invInstance : Store.settings().instance).replace(/\/$/, '');
  const settingKey = (b) => (b === 'invidious' ? 'invInstance' : 'instance');

  // Desktop app (Tauri): use the native HTTP client – no browser CORS limits, so every instance works.
  // Android app (Capacitor): CapacitorHttp patches window.fetch natively (see capacitor.config.json).
  const tauriFetch = window.__TAURI__ && window.__TAURI__.http && window.__TAURI__.http.fetch;
  const isNativeApp = !!(tauriFetch || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));

  async function fetchJson(url, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = tauriFetch
        ? await tauriFetch(url, { method: 'GET', signal: ctrl.signal, connectTimeout: timeoutMs })
        : await fetch(url, { signal: ctrl.signal, referrerPolicy: 'no-referrer' });
      if (!res.ok) {
        let msg = 'HTTP ' + res.status;
        try { const j = await res.json(); if (j && (j.message || j.error)) msg = j.message || j.error; } catch (e) {}
        const err = new Error(msg); err.status = res.status; throw err;
      }
      const data = await res.json();
      if (data && data.error && !Array.isArray(data)) { const err = new Error(data.message || data.error); err.status = 500; throw err; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function instances(b = backend()) {
    if (instanceLists[b]) return instanceLists[b];
    try {
      if (b === 'invidious') {
        const list = await fetchJson('https://api.invidious.io/instances.json?sort_by=health', 8000);
        instanceLists[b] = list.filter(([, i]) => i.type === 'https' && i.api && i.cors !== false)
          .map(([host, i]) => ({ name: host, url: i.uri.replace(/\/$/, ''), locations: i.region || '' }));
      } else {
        const list = await fetchJson('https://piped-instances.kavin.rocks/', 8000);
        instanceLists[b] = list.filter(i => i.api_url).map(i => ({ name: i.name, url: i.api_url.replace(/\/$/, ''), locations: i.locations || '' }));
      }
      if (!instanceLists[b].length) throw new Error('empty');
    } catch (e) {
      instanceLists[b] = FALLBACK[b].map(u => ({ name: new URL(u).hostname, url: u, locations: '' }));
    }
    return instanceLists[b];
  }

  /** GET on the current instance; on server errors tries other instances and keeps the one that works. */
  async function api(path, b = backend()) {
    const current = baseOf(b);
    try {
      return await fetchJson(current + path);
    } catch (err) {
      if (err.status && err.status < 500 && err.status !== 429 && err.status !== 403) throw err;
      const list = (await instances(b)).map(i => i.url);
      const candidates = [...new Set([...FALLBACK[b], ...list])].filter(u => u !== current).slice(0, 6);
      for (const base of candidates) {
        try {
          const data = await fetchJson(base + path, 9000);
          Store.setSetting(settingKey(b), base);
          window.dispatchEvent(new CustomEvent('strova:instance', { detail: base }));
          return data;
        } catch (e) { /* next */ }
      }
      throw err;
    }
  }

  const idFromUrl = (u) => {
    if (!u) return '';
    const m = /[?&]v=([\w-]{6,})/.exec(u) || /\/(?:channel|c|user|playlist)\/([^/?#]+)/.exec(u) || /\/([\w-]{11})$/.exec(u);
    return m ? m[1] : u.replace(/^\//, '');
  };

  // ───────── Image quality ─────────
  // YouTube serves several sizes of the same image; APIs often hand out small ones. Ask for sharp versions;
  // a global error handler (app.js) steps back down if a size doesn't exist for a video.
  // Square album art (googleusercontent, "=w120-h120-…") → 544 px; video thumbnails → hq720
  const hiThumb = (u) => (u || '')
    .replace(/=w\d+-h\d+(-|$)/, '=w544-h544$1')
    .replace(/\/(default|mqdefault|hqdefault|sddefault)(_live)?\.(jpg|webp)/, '/hq720$2.$3');
  const maxThumb = (u) => hiThumb(u)
    .replace(/=w544-h544(-|$)/, '=w1080-h1080$1')
    .replace(/\/hq720(_live)?\.(jpg|webp)/, '/maxresdefault$1.$2');
  const hiAvatar = (u) => (u || '').replace(/=s\d+(-|$)/, '=s240$1').replace(/\/s\d+(-c-k[^/]*)\//, '/s240$1/');
  const hiBanner = (u) => (u || '').replace(/=w\d+(-|$)/, '=w2120$1');

  // ───────── Piped ─────────
  const P = {
    video(item) {
      return {
        type: 'video', id: idFromUrl(item.url), title: item.title, thumbnail: hiThumb(item.thumbnail),
        uploaderName: item.uploaderName, uploaderUrl: item.uploaderUrl ? idFromUrl(item.uploaderUrl) : '',
        uploaderAvatar: hiAvatar(item.uploaderAvatar), verified: !!item.uploaderVerified, duration: item.duration, views: item.views,
        uploadedDate: item.uploadedDate, uploaded: item.uploaded,
        isShort: !!item.isShort || /\/shorts\//.test(item.url || '') || (item.duration > 0 && item.duration <= 60),
        live: item.duration === -1,
      };
    },
    channel(item) {
      return { type: 'channel', id: idFromUrl(item.url), name: item.name, avatar: hiAvatar(item.thumbnail), verified: !!item.verified, subscribers: item.subscribers, videos: item.videos };
    },
    item(i) { return i.type === 'channel' ? P.channel(i) : i.type === 'playlist' ? null : P.video(i); },
    async trending(region) { return (await api('/trending?region=' + encodeURIComponent(region || 'DE'))).map(P.video); },
    async search(q, filter = 'all', nextpage) {
      const path = nextpage
        ? `/nextpage/search?q=${encodeURIComponent(q)}&filter=${filter}&nextpage=${encodeURIComponent(nextpage)}`
        : `/search?q=${encodeURIComponent(q)}&filter=${filter}`;
      const d = await api(path);
      return { items: (d.items || []).map(P.item).filter(Boolean), nextpage: d.nextpage || null };
    },
    async suggestions(q) { return fetchJson(baseOf('piped') + '/suggestions?query=' + encodeURIComponent(q), 4000); },
    async streams(id) {
      const d = await api('/streams/' + encodeURIComponent(id));
      return {
        id, title: d.title, description: d.description || '', uploadDate: d.uploadDate,
        uploaderName: d.uploader, uploaderUrl: idFromUrl(d.uploaderUrl), uploaderAvatar: hiAvatar(d.uploaderAvatar), verified: !!d.uploaderVerified,
        subscribers: d.uploaderSubscriberCount, thumbnail: maxThumb(d.thumbnailUrl), duration: d.duration, views: d.views, likes: d.likes,
        live: !!d.livestream, hls: d.hls || null, videoStreams: d.videoStreams || [], audioStreams: d.audioStreams || [],
        subtitles: d.subtitles || [], chapters: d.chapters || [],
        related: (d.relatedStreams || []).filter(r => !r.type || r.type === 'stream').map(P.video),
      };
    },
    async channel(id, nextpage) {
      if (nextpage) {
        const d = await api(`/nextpage/channel/${encodeURIComponent(id)}?nextpage=${encodeURIComponent(nextpage)}`);
        return { videos: (d.relatedStreams || []).map(P.video), nextpage: d.nextpage || null };
      }
      const d = await api('/channel/' + encodeURIComponent(id));
      return {
        id: d.id, name: d.name, avatar: hiAvatar(d.avatarUrl), banner: hiBanner(d.bannerUrl), description: d.description || '',
        subscribers: d.subscriberCount, verified: !!d.verified, videos: (d.relatedStreams || []).map(P.video), nextpage: d.nextpage || null,
      };
    },
    async feed(ids) {
      const d = await api('/feed/unauthenticated?channels=' + ids.map(encodeURIComponent).join(','));
      return d.map(P.video);
    },
  };

  // ───────── Invidious ─────────
  const abs = (u) => {
    if (!u) return '';
    if (u.startsWith('//')) return 'https:' + u;
    if (u.startsWith('/')) return baseOf('invidious') + u;
    return u;
  };
  const best = (arr, prefer) => {
    if (!arr || !arr.length) return '';
    const p = prefer && arr.find(t => t.quality === prefer);
    return abs((p || arr.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]).url);
  };
  const thumbOf = (v) => hiThumb(best(v.videoThumbnails, 'high') || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`);
  const avatarOf = (arr) => {
    if (!arr || !arr.length) return '';
    const s = arr.slice().sort((a, b) => (a.width || 0) - (b.width || 0)).find(t => (t.width || 0) >= 176) || arr.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    return hiAvatar(abs(s.url));
  };
  const SEARCH_TYPE = { all: 'all', videos: 'video', channels: 'channel', music_songs: 'video', music_artists: 'channel' };
  const I = {
    video(v) {
      return {
        type: 'video', id: v.videoId, title: v.title, thumbnail: thumbOf(v),
        uploaderName: v.author, uploaderUrl: v.authorId || '', uploaderAvatar: avatarOf(v.authorThumbnails), verified: !!v.authorVerified,
        duration: v.lengthSeconds, views: v.viewCount, uploadedDate: v.publishedText || '', uploaded: v.published ? v.published * 1000 : 0,
        isShort: v.lengthSeconds > 0 && v.lengthSeconds <= 60, live: !!v.liveNow,
      };
    },
    channel(c) {
      return { type: 'channel', id: c.authorId, name: c.author, avatar: avatarOf(c.authorThumbnails), verified: !!c.authorVerified, subscribers: c.subCount, videos: c.videoCount };
    },
    item(i) { return i.type === 'channel' ? I.channel(i) : i.type === 'video' ? I.video(i) : null; },
    async trending(region) {
      const d = await api('/api/v1/trending?region=' + encodeURIComponent(region || 'DE'));
      return d.filter(v => v.type === 'video' || v.videoId).map(I.video);
    },
    async search(q, filter = 'all', nextpage) {
      const page = nextpage ? +nextpage : 1;
      const music = /^music_/.test(filter);
      const query = music && filter === 'music_songs' ? q + ' audio' : q;
      const d = await api(`/api/v1/search?q=${encodeURIComponent(query)}&type=${SEARCH_TYPE[filter] || 'all'}&page=${page}`);
      const items = d.map(I.item).filter(Boolean);
      return { items, nextpage: items.length ? String(page + 1) : null };
    },
    async suggestions(q) {
      const d = await fetchJson(baseOf('invidious') + '/api/v1/search/suggestions?q=' + encodeURIComponent(q), 4000);
      return (d.suggestions || []).map(s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    },
    async streams(id) {
      const d = await api(`/api/v1/videos/${encodeURIComponent(id)}?local=true`);
      return {
        id, title: d.title, description: (d.descriptionHtml || d.description || '').replace(/\n/g, '<br>'),
        uploadDate: d.published ? new Date(d.published * 1000).toISOString() : '',
        uploaderName: d.author, uploaderUrl: d.authorId, uploaderAvatar: avatarOf(d.authorThumbnails), verified: !!d.authorVerified,
        subscribers: parseSubs(d.subCountText), thumbnail: best(d.videoThumbnails, 'maxresdefault') || best(d.videoThumbnails),
        duration: d.lengthSeconds, views: d.viewCount, likes: d.likeCount, live: !!d.liveNow,
        hls: d.hlsUrl ? abs(d.hlsUrl) : null,
        videoStreams: (d.formatStreams || []).map(f => ({ url: abs(f.url), mimeType: (f.type || '').split(';')[0], quality: f.qualityLabel || f.quality, videoOnly: false })),
        audioStreams: (d.adaptiveFormats || []).filter(f => /^audio\//.test(f.type || '')).map(f => ({ url: abs(f.url), mimeType: (f.type || '').split(';')[0], bitrate: +f.bitrate || 0 })),
        subtitles: (d.captions || []).map(c => ({ url: abs(c.url), mimeType: 'text/vtt', name: c.label, code: c.languageCode || c.language_code, autoGenerated: /auto/i.test(c.label) })),
        chapters: [],
        related: (d.recommendedVideos || []).map(r => I.video(Object.assign({ viewCount: r.viewCount }, r))),
      };
    },
    async channel(id, nextpage) {
      const vids = await api(`/api/v1/channels/${encodeURIComponent(id)}/videos${nextpage ? '?continuation=' + encodeURIComponent(nextpage) : ''}`);
      const videos = (vids.videos || []).map(I.video);
      if (nextpage) return { videos, nextpage: vids.continuation || null };
      const c = await api('/api/v1/channels/' + encodeURIComponent(id));
      return {
        id: c.authorId, name: c.author, avatar: avatarOf(c.authorThumbnails), banner: c.authorBanners && c.authorBanners[0] ? abs(c.authorBanners[0].url) : '',
        description: c.description || '', subscribers: c.subCount, verified: !!c.authorVerified, videos, nextpage: vids.continuation || null,
      };
    },
    async feed(ids) {
      const lists = await Promise.all(ids.slice(0, 40).map(id =>
        api(`/api/v1/channels/${encodeURIComponent(id)}/videos`).then(d => (d.videos || []).slice(0, 10).map(I.video)).catch(() => [])));
      return lists.flat();
    },
  };
  function parseSubs(t) {
    if (!t) return 0;
    const m = /([\d.,]+)\s*([KMB])?/i.exec(t); if (!m) return 0;
    return Math.round(parseFloat(m[1].replace(',', '.')) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1));
  }

  const impl = () => (backend() === 'invidious' ? I : P);

  // ───────── Content filters (hidden channels, shorts, live) ─────────
  function visible(v) {
    if (!v) return false;
    const s = Store.settings();
    if (v.type === 'channel') return !Store.isHidden(v.id);
    if (Store.isHidden(v.uploaderUrl)) return false;
    if (s.hideShorts && v.isShort) return false;
    if (s.hideLive && v.live) return false;
    return true;
  }

  /** Videos of a channel via search (keeps only results that really belong to the channel). */
  async function channelViaSearch(id, name, nextpage) {
    const r = await impl().search(name, 'videos', nextpage);
    const videos = r.items.filter(v => v.type === 'video' && v.uploaderUrl === id);
    return { videos, nextpage: r.nextpage && videos.length ? `search:${encodeURIComponent(name)}:${r.nextpage}` : null };
  }

  const Piped = {
    FALLBACK, instances, idFromUrl, backend, visible, isNativeApp, hiThumb, maxThumb,
    async trending(region) { return (await impl().trending(region)).filter(visible); },
    async search(q, filter = 'all', nextpage) { const r = await impl().search(q, filter, nextpage); r.items = r.items.filter(visible); return r; },
    async suggestions(q) { try { return await impl().suggestions(q); } catch (e) { return []; } },
    async streams(id) { const d = await impl().streams(id); d.related = d.related.filter(visible); return d; },
    async channel(id, nextpage) {
      // "search:<name>:<page>" marks pagination of the search fallback below
      if (nextpage && nextpage.startsWith('search:')) {
        const [, name, np] = nextpage.match(/^search:(.*?):(.*)$/) || [];
        const r = await channelViaSearch(id, decodeURIComponent(name || ''), np || undefined);
        return { videos: r.videos.filter(v => !(Store.settings().hideShorts && v.isShort)), nextpage: r.nextpage };
      }
      const c = await impl().channel(id, nextpage);
      // Some instances return channel pages without videos (YouTube changes) → fall back to a search by channel name.
      if (!nextpage && !c.videos.length && c.name) {
        try { const r = await channelViaSearch(id, c.name); c.videos = r.videos; c.nextpage = r.nextpage; } catch (e) { /* keep empty */ }
      }
      c.videos = c.videos.filter(v => !(Store.settings().hideShorts && v.isShort));
      return c;
    },
    async feed(ids) {
      if (!ids.length) return [];
      let items = [];
      try { items = await impl().feed(ids); } catch (e) { /* use fallback below */ }
      // Top up channels the feed returned (almost) nothing for
      const subs = Store.subs();
      const thin = ids.filter(id => items.filter(v => v.uploaderUrl === id).length < 3).slice(0, 15);
      if (thin.length) {
        const extra = await Promise.all(thin.map(id => {
          const s = subs.find(x => x.id === id);
          return s && s.name ? channelViaSearch(id, s.name).then(r => r.videos.slice(0, 12)).catch(() => []) : [];
        }));
        const have = new Set(items.map(v => v.id));
        extra.flat().forEach(v => { if (!have.has(v.id)) { have.add(v.id); items.push(v); } });
      }
      return items.filter(visible).sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0));
    },
  };

  window.Piped = Piped;
})();
