/* Strova – local storage (everything stays on this device) */
(function () {
  const PREFIX = 'strova.';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }

  const DEFAULT_SETTINGS = {
    backend: 'piped',
    instance: 'https://api.piped.private.coffee',
    invInstance: 'https://inv.nadeko.net',
    hideShorts: false,
    hideLive: false,
    sponsorBlock: true,
    sbCategories: ['sponsor', 'selfpromo', 'interaction'],
    defaultQuality: 'auto',
    region: 'DE',
    theme: 'system',
    autoplayNext: true,
    preferHls: true,
    defaultSpeed: 1,
    resume: true,
    saveHistory: true,
    captions: false,
  };

  const LIMIT_HISTORY = 300;

  /** Small, serialisable summary of a video, used in lists. */
  function slim(v) {
    return {
      id: v.id, title: v.title || '', thumbnail: v.thumbnail || '', uploaderName: v.uploaderName || '',
      uploaderUrl: v.uploaderUrl || '', uploaderAvatar: v.uploaderAvatar || '', duration: v.duration || 0,
    };
  }

  const Store = {
    settings() { return Object.assign({}, DEFAULT_SETTINGS, read('settings', {})); },
    setSetting(key, value) { const s = Store.settings(); s[key] = value; write('settings', s); return s; },

    // Subscriptions: [{id, name, avatar}]
    subs() { return read('subs', []); },
    isSubbed(id) { return Store.subs().some(s => s.id === id); },
    toggleSub(ch) {
      let subs = Store.subs();
      const on = subs.some(s => s.id === ch.id);
      subs = on ? subs.filter(s => s.id !== ch.id) : [{ id: ch.id, name: ch.name, avatar: ch.avatar || '' }, ...subs];
      write('subs', subs);
      return !on;
    },

    // Hidden channels: [{id, name, avatar}]
    hidden() { return read('hidden', []); },
    isHidden(id) { return !!id && Store.hidden().some(h => h.id === id); },
    hideChannel(ch) { if (!ch.id || Store.isHidden(ch.id)) return; write('hidden', [{ id: ch.id, name: ch.name || ch.id, avatar: ch.avatar || '' }, ...Store.hidden()]); },
    unhideChannel(id) { write('hidden', Store.hidden().filter(h => h.id !== id)); },

    // History: newest first
    history() { return read('history', []); },
    addHistory(v) {
      if (!Store.settings().saveHistory) return;
      const list = Store.history().filter(h => h.id !== v.id);
      list.unshift(Object.assign(slim(v), { at: Date.now() }));
      write('history', list.slice(0, LIMIT_HISTORY));
    },
    clearHistory() { write('history', []); write('positions', {}); },

    // Watch later / favourites
    saved() { return read('saved', []); },
    isSaved(id) { return Store.saved().some(s => s.id === id); },
    toggleSaved(v) {
      let list = Store.saved();
      const on = list.some(s => s.id === v.id);
      list = on ? list.filter(s => s.id !== v.id) : [Object.assign(slim(v), { at: Date.now() }), ...list];
      write('saved', list);
      return !on;
    },

    // Emotions: { [videoId]: {emoji, ...slim, at} }
    reactions() { return read('reactions', {}); },
    reactionOf(id) { const r = Store.reactions()[id]; return r ? r.emoji : null; },
    setReaction(v, emoji) {
      const all = Store.reactions();
      if (!emoji || (all[v.id] && all[v.id].emoji === emoji)) { delete all[v.id]; write('reactions', all); return null; }
      all[v.id] = Object.assign(slim(v), { emoji, at: Date.now() });
      write('reactions', all);
      return emoji;
    },

    // Resume positions: { [videoId]: {t, d} }
    position(id) { const p = read('positions', {})[id]; return p || null; },
    setPosition(id, t, d) {
      const all = read('positions', {});
      if (!d || t < 5 || t > d - 8) delete all[id]; else all[id] = { t: Math.floor(t), d: Math.floor(d) };
      const keys = Object.keys(all);
      if (keys.length > 500) delete all[keys[0]];
      write('positions', all);
    },

    exportAll() {
      const out = {};
      ['settings', 'subs', 'history', 'saved', 'reactions', 'positions', 'hidden'].forEach(k => { out[k] = read(k, null); });
      return out;
    },
    importAll(data) {
      if (data && Array.isArray(data.subscriptions)) { // LibreTube / NewPipe-style subscription export
        const subs = data.subscriptions.map(s => ({ id: Piped.idFromUrl(s.url || s.channelId || ''), name: s.name || '', avatar: s.avatar || '' })).filter(s => s.id);
        const have = new Set(Store.subs().map(s => s.id));
        write('subs', [...Store.subs(), ...subs.filter(s => !have.has(s.id))]);
      }
      ['settings', 'subs', 'history', 'saved', 'reactions', 'positions', 'hidden'].forEach(k => { if (data && data[k] != null) write(k, data[k]); });
    },
  };

  window.Store = Store;
})();
