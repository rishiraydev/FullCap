<div align="center">

<img src="icons/icon128.png" alt="FullCap Logo" width="96" height="96">

# FullCap — Full Page Screenshot Extension

**A powerful Chrome extension to capture full-page screenshots, annotate them, and export as PNG, JPG, or PDF.**

[![Manifest](https://img.shields.io/badge/Manifest-V3-brightgreen?style=flat-square&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0-orange?style=flat-square)]()

</div>

---

## ✨ Features

- 📸 **Full Page Capture** — Captures the entire scrollable page, not just the visible area
- 🖊️ **Annotation Tools** — Draw, add rectangles, and place text directly on the screenshot
- ✂️ **Crop Tool** — Precisely crop any region of the captured image
- 💾 **Multi-Format Export** — Save as **PNG**, **JPG**, or **PDF**
- 🎯 **SPA Support** — Intelligently detects scrollable containers in React/Vue/Angular apps
- ⚡ **Instant Capture** — Click the extension icon — no popup, no extra steps
- 🔧 **Smart Scroll** — Waits for page to fully settle before each capture frame (no broken stitches)
- 🧠 **Memory Safe** — Auto-compresses large captures to prevent storage quota errors

---

## 🖥️ Screenshots

> *Click the extension icon → Full page is captured → Edit & Export*

| Capture & Edit | Export Options |
|---|---|
| Annotate with draw, rect, text tools | Save as PNG, JPG, or PDF |

---

## 📦 Installation (Developer Mode)

Since this extension is not yet on the Chrome Web Store, install it manually:

1. **Download / Clone** this repository:
   ```bash
   git clone https://github.com/rishiray/FullCap.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. Enable **Developer Mode** (toggle in the top-right corner)

4. Click **"Load unpacked"**

5. Select the `FullCap` folder

6. The 📷 FullCap icon will appear in your Chrome toolbar

---

## 🚀 How to Use

1. Navigate to any webpage you want to capture
2. Click the **FullCap icon** in the Chrome toolbar
3. The extension will automatically:
   - Scroll through the entire page
   - Capture each viewport segment
   - Stitch all segments into one seamless image
4. The **Editor** opens automatically with your full-page screenshot
5. Use the floating toolbar to annotate:
   | Tool | Shortcut | Description |
   |------|----------|-------------|
   | Select | `V` | Move and resize objects |
   | Draw | `B` | Freehand drawing |
   | Rectangle | `R` | Draw highlight boxes |
   | Text | `T` | Add text labels |
   | Crop | `C` | Crop the image |
   | Delete | `Del` | Remove selected object |
6. Click **Save PNG**, **Save JPG**, or **Save PDF** to export

---

## 🗂️ Project Structure

```
FullCap/
├── manifest.json        # Chrome Extension Manifest V3 config
├── background.js        # Service worker — capture trigger, storage, offscreen bridge
├── content.js           # Injected into page — scroll detection & viewport capture loop
├── offscreen.js         # Offscreen canvas — stitches all viewport captures together
├── offscreen.html       # Offscreen document host
├── editor.html          # Screenshot editor UI
├── editor.js            # Editor logic (Fabric.js canvas, tools, export)
├── editor.css           # Editor styles
├── lib/
│   ├── fabric.min.js    # Fabric.js (canvas annotation library)
│   └── jspdf.umd.min.js # jsPDF (PDF export library)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚙️ How It Works

```
User clicks icon
       │
       ▼
background.js (service worker)
  → Injects content.js into the page
       │
       ▼
content.js
  → Disables animations & smooth scroll
  → Detects the scrollable container (window or SPA inner div)
  → Scrolls top → bottom, capturing each viewport
  → Waits for scroll to fully settle before each capture
  → Sends all frames to background
       │
       ▼
background.js
  → Creates offscreen document
  → Forwards frames to offscreen.js
       │
       ▼
offscreen.js
  → Stitches all frames onto a single canvas
  → Trims overlapping pixels precisely
  → Sends final image back to background
       │
       ▼
background.js
  → Stores image in chrome.storage.local
  → Opens editor.html in a new tab
       │
       ▼
editor.js (Fabric.js)
  → Loads image onto canvas
  → Provides annotation tools
  → Exports final result
```

---

## 🛠️ Tech Stack

| Library | Purpose |
|---------|---------|
| [Fabric.js](http://fabricjs.com/) | Canvas-based annotation editor |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF generation and export |
| Chrome Extension Manifest V3 | Extension platform |

> All libraries are **bundled locally** — no CDN or internet dependency required for core functionality.

---

## 🔐 Permissions

| Permission | Why It's Needed |
|------------|----------------|
| `activeTab` | Access the current tab for capture |
| `scripting` | Inject content.js into the page |
| `storage` | Temporarily store the captured image |
| `offscreen` | Use an offscreen canvas for image stitching |
| `tabs` | Open the editor in a new tab |
| `unlimitedStorage` | Allow large screenshots without quota errors |
| `<all_urls>` (host) | Capture any website |

---

## 🐛 Known Limitations

- **Chrome-only** — Uses Chrome-specific APIs (`captureVisibleTab`, Manifest V3 offscreen)
- **Extension pages** — Cannot capture `chrome://` pages (browser restriction)
- **Very long pages** — Pages with 10,000+ px height may take a few seconds to process
- **Lazy-loaded content** — Images that only load on scroll may not fully appear (depends on the site)

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Rishi Ray**  
[rishiray.info@gmail.com](mailto:rishiray.info@gmail.com)  
© 2026 Rishi Ray. All rights reserved.

---

<div align="center">

Made with ❤️ for developers who need clean, full-page screenshots

⭐ **Star this repo if you find it useful!**

</div>

