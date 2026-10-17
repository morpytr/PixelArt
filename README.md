# PixelArt

Minecraft skin & image → pixel art converter for Skript / Plugin creators.

## What it does

Load any Minecraft skin (by UUID or username) or upload your own PNG, turn it into pixel art, and export ready-to-use Skript / Plugin code with `&#RRGGBB` hex colors.

## Features

- **UUID / skin name input** – Paste a Minecraft UUID or username and the skin loads automatically.
- **Upload PNG** – Load your own image, crop it to a square in the built-in pixel editor, and paint individual pixels.
- **Hat overlay auto-detect** – If the skin has a second layer (hat), "Include hat" is ticked automatically.
- **Pixel editor** – Drag to select a square region, click pixels to paint, toggle transparent brush, auto-remove background.
- **Output formats**
  - `&#RRGGBB` – Skript / Plugin hex colors (WelcomeHead style)
  - `<#RRGGBB>` – Skript hex
  - `§x§R§R§G§G§B§B` – Minecraft legacy section codes
  - `&x&R&R...` – Legacy amp codes
  - Minecraft 16 colors (nearest match)
- **Block character** – █ ▓ ▒ ░ # @ with live preview.
- **Sizes** – 4×4, 6×6, 8×8 (recommended), 10×10, 12×12, or any custom size (2–32).
- **Export** – Copy to clipboard, download `.sk`, `.txt`, or `SVG`.
- **Skript output** – Ready-to-paste `command /name: trigger: send "..." to player` blocks.

## Demo output

```
command /pixelart:
    trigger:
        send "&#eeb49f████████&r" to player
        send "&#eeb49f█&#000000█&#eeb49f████&#000000█&#eeb49f█&r" to player
```

## Run the app

This is an Electron app. No `npm install` needed.

```bash
# Download or clone this folder, then:
cd /home/morpy/Desktop/PixelArt
./run.sh
```

Or run Electron directly:

```bash
electron44 /home/morpy/Desktop/PixelArt
```

## Installers (.exe, .dmg, .AppImage, .deb)

PixelArt is built with Electron, so it can be packaged for Windows, macOS, and Linux using [electron-builder](https://www.electron.build/).

**One-time setup:**

```bash
cd /home/morpy/Desktop/PixelArt
npm init -y
npm install --save-dev electron-builder
```

Add this to `package.json`:

```json
"build": {
  "appId": "com.morpytr.pixelart",
  "productName": "PixelArt",
  "directories": {
    "output": "release"
  },
  "files": [
    "main.js",
    "preload.js",
    "renderer/**/*",
    "icon.png"
  ],
  "mac": {
    "target": ["dmg", "zip"]
  },
  "win": {
    "target": ["nsis", "zip"],
    "icon": "icon.png"
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "icon": "icon.png"
  }
}
```

**Build:**

```bash
npx electron-builder
```

Output appears in the `release/` folder:
- Windows: `PixelArt Setup x64.exe`
- macOS: `PixelArt.dmg`
- Linux: `PixelArt.AppImage`, `.deb`, `.rpm`

## GitHub releases

Assets can be attached to a GitHub release just like the example below:

```
Assets (31)
├── PixelArt Setup x64.exe      (Windows)
├── PixelArt-1.0.0.dmg          (macOS)
├── PixelArt-1.0.0.AppImage     (Linux)
├── pixelart_1.0.0_amd64.deb    (Debian/Ubuntu)
└── pixelart-1.0.0.x86_64.rpm   (RPM)
```

Create a release at https://github.com/morpytr/PixelArt/releases and upload the files from `release/`.

## Footer

The footer links to [github.com/morpytr](https://github.com/morpytr) and opens in your default browser.

## License

MIT License
