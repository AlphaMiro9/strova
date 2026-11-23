<p align="center"><img src="www/icons/icon-192.png" width="96" alt="Strova"></p>
<h1 align="center">Strova</h1>
<p align="center"><b>YouTube & Musik – ohne Konto, ohne Tracking, mit eigenem Player.</b><br>
Für Windows (x64 & ARM64), macOS, Linux (x64 & ARM64), Android und als Web-App für iPhone & alle Browser.</p>

---

## Funktionen

**Videos**
- Trends, Suche mit Vorschlägen, Kanäle, Abos ohne Google-Konto
- Eigener Player: Qualität, Tempo, Untertitel, Bild-im-Bild, Vollbild, Doppeltippen zum Spulen, Tastenkürzel
- Weiterschauen an der letzten Stelle, Autoplay, Sperrbildschirm-Steuerung
- **SponsorBlock**: Sponsoren, Intros & Co. werden automatisch übersprungen (gelb in der Zeitleiste)

**Musik** (wie Spotube / SimpMusic)
- Genres & Stimmungen, Song- und Künstlersuche
- Mini-Player, Vollbild „Läuft gerade“ mit Cover, Warteschlange, Shuffle, Wiederholen
- Lieblingssongs, eigene Playlists, **Radio-Modus** (hängt ähnliche Songs automatisch an)

**Stimmungen**
- Reagiere auf Videos mit 😍 😂 🤯 🥹 😴 🔥 – mit Animation; alles landet in deiner Sammlung
- Mood-Mixe: Lachen, Chillen, Energie, Staunen, Zocken …

**Einstellungen** (wie LibreTube)
- Quelle umschalten: **Piped** oder **Invidious**, Instanz wählen/testen, eigene Instanz, automatischer Wechsel bei Ausfall
- **Kanäle ausblenden**, Shorts und Livestreams ausblenden
- Standardqualität & -tempo, Region, Hell/Dunkel
- Export/Import (versteht auch LibreTube/NewPipe-Abo-Exporte)

## Download

Fertige Installer gibt es unter **[Releases](../../releases)**:

| Plattform | Datei |
|---|---|
| Windows x64 / ARM64 | `.msi` oder `-setup.exe` |
| macOS (Apple Silicon & Intel) | `.dmg` |
| Linux x64 / ARM64 | `.AppImage`, `.deb`, `.rpm` |
| Android | `Strova-android.apk` |
| iPhone / iPad / jeder Browser | Web-App über GitHub Pages öffnen → „Zum Home-Bildschirm“ |

> Die Android-APK ist mit einem Entwicklungsschlüssel signiert. Beim Installieren „Aus unbekannten Quellen“ erlauben.
> macOS-Builds sind nicht notarisiert: beim ersten Start Rechtsklick → „Öffnen“.

## Entwickeln

```bash
npm install          # lädt hls.js nach www/vendor
npm run dev          # Web-Version auf http://localhost:5173
npm run desktop:dev  # Desktop-App (braucht Rust: https://rustup.rs)
npm run icons        # Icons aus www/icons/icon.svg neu erzeugen
```

Ein neuer Release entsteht automatisch, wenn ein Tag gepusht wird:

```bash
git tag v1.0.1 && git push --tags
```

**Aufbau:** `www/` ist die App (HTML/CSS/JS, keine Build-Tools nötig). `src-tauri/` verpackt sie als Desktop-App, Capacitor (`capacitor.config.json`) als Android-App. In den nativen Apps laufen API-Anfragen nativ, dadurch funktionieren dort auch Invidious-Instanzen, die Browser-Zugriffe blockieren.

## Rechtliches

Strova ist nicht mit YouTube, Google oder Spotify verbunden. Alle Inhalte gehören ihren Urhebern. SponsorBlock-Daten: [sponsor.ajay.app](https://sponsor.ajay.app) (CC BY-NC-SA 4.0). Lizenz: MIT.
