# Notizen App – Setup auf dem Raspberry Pi

## 1. Dateien kopieren

```bash
scp -r notes-app/ pi@<PI-IP>:~/
```

Oder per Git / USB auf den Pi bringen.

## 2. Flask installieren

```bash
pip3 install -r requirements.txt
```

## 3. App starten (Testlauf)

```bash
cd ~/notes-app
python3 app.py
```

Aufruf im Browser (Handy im selben Tailscale-Netz):
```
http://<PI-TAILSCALE-IP>:5000
```

## 4. Als Systemdienst einrichten (autostart)

```bash
sudo cp notes-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable notes-app
sudo systemctl start notes-app
```

Status prüfen:
```bash
sudo systemctl status notes-app
```

Logs anschauen:
```bash
journalctl -u notes-app -f
```

## 5. Farben anpassen

Öffne `templates/index.html` und ändere die Variablen ganz oben im `<style>`-Block:

```css
:root {
  --bg-app:    #1c1c1e;   /* App-Hintergrund  */
  --accent:    #ffd60a;   /* Akzentfarbe      */
  /* ... */
}
```

## 6. Neue Formatier-Buttons hinzufügen

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
