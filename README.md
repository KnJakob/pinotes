# pinotes – Notizen App

## 1. Voraussetzungen

- [uv](https://docs.astral.sh/uv/) installieren: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Python 3.13+

## 2. Dateien kopieren

```bash
scp -r pinotes/ pi@<PI-IP>:~/
```

Oder per Git / USB auf den Pi bringen.

## 3. Abhängigkeiten installieren

```bash
cd ~/pinotes
uv sync
```

## 4. App starten (Testlauf)

```bash
cd ~/pinotes
uv run python app.py
```

Aufruf im Browser (Handy im selben Tailscale-Netz):
```
http://<PI-TAILSCALE-IP>:5000
```

## 5. Als Systemdienst einrichten (Autostart)

```bash
sudo cp pinotes.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pinotes
```

Status prüfen:
```bash
sudo systemctl status pinotes
```

Logs anschauen:
```bash
sudo journalctl -u pinotes -f
```

## 6. Farben anpassen

Öffne `templates/index.html` und ändere die Variablen ganz oben im `<style>`-Block:

```css
:root {
  --bg-app:    #1c1c1e;   /* App-Hintergrund  */
  --accent:    #ffd60a;   /* Akzentfarbe      */
  /* ... */
}
```

## 7. Neue Formatier-Buttons hinzufügen

In `index.html` im Toolbar-Bereich einfach einen neuen Button ergänzen:

```html
<button class="fmt-btn" onclick="fmt('underline')" title="Unterstrichen"><u>U</u></button>
```

Und in `updateFmtButtons()` den State aktualisieren:
```js
document.getElementById('fmt-u').classList.toggle('active', document.queryCommandState('underline'));
```

## Daten

Alle Notizen werden in `data.json` im selben Ordner gespeichert.
Ein manuelles Backup: `cp data.json data.backup.json`
