# Skool Transcript Extractor

A Chrome extension that extracts full transcripts from Skool.com video recordings.

Skool's video player (Mux) lazy-loads captions — you only get text for the parts you've actually watched. This extension works around that by automatically seeking through the entire video, forcing all captions to load, then letting you copy or download the complete transcript.

**Credit:** Originally built by [Holger Morlok](https://www.skool.com/@holger-morlok-2493) and shared in the [Early AI-dopters](https://www.skool.com/earlyaidopters/extract-full-transcripts-from-skool-video-recordings) Skool community.

---

## Prerequisites

- Google Chrome browser (or any Chromium-based browser: Edge, Brave, Arc, etc.)
- That's it. No Node.js, no npm, no build tools needed.

---

## Installation (Step by Step)

This is an "unpacked" extension — it runs directly from the folder on your computer instead of the Chrome Web Store.

### 1. Get the files onto your computer

If you already have this folder (you're reading this README from it), skip to step 2.

Otherwise, download or clone the repository so you have the folder somewhere on your machine. Remember where it is — you'll point Chrome to it.

### 2. Open Chrome's extension manager

Type this into your Chrome address bar and press Enter:

```
chrome://extensions
```

You can also get there via menu: **Chrome menu (⋮)** → **Extensions** → **Manage Extensions**.

### 3. Turn on Developer Mode

In the top-right corner of the extensions page, you'll see a toggle labeled **Developer mode**. Turn it **ON**. This is required to load your own extensions.

### 4. Load the extension

Click the **"Load unpacked"** button that appeared in the top-left after enabling Developer Mode.

A folder picker will open. Navigate to and select **this folder** — the one containing `manifest.json` (e.g., `C:\Users\danie\ws\Chrome\skool-transcript-extractor`).

### 5. Confirm it loaded

You should now see **"Skool Transcript Extractor"** in your extensions list with its purple icon. If you see any errors in red, something went wrong — check that you selected the correct folder.

### 6. Pin it for easy access (optional but recommended)

Click the **puzzle piece icon** (🧩) in Chrome's toolbar (top-right, next to the address bar). Find "Skool Transcript Extractor" in the dropdown and click the **pin icon** next to it. The extension icon will now always be visible in your toolbar.

---

## How to Use

### 1. Go to a Skool video recording

Navigate to any Skool community page that has a native video recording. The video must have **closed captions (CC) available** — look for the CC button on the video player controls.

### 2. Make sure CC is enabled

Click the **CC button** on the video player so that captions are turned on. The extension needs an active caption track to extract text from.

### 3. Click the extension icon

Click the Skool Transcript Extractor icon in your toolbar. A popup will appear showing the status:

- **Green "Ready"** — Video and captions detected, you're good to go.
- **Yellow "No captions available"** — Video found but no CC track. Enable CC on the player first.
- **Yellow "No video found"** — You're not on a page with a Skool video.

### 4. Choose your format

Use the **Format** dropdown to pick your output:

| Format | What you get | Good for |
|---|---|---|
| **Plain Text** | Flowing text, no timestamps | Pasting into AI tools for summaries |
| **With Timestamps** | `[M:SS] text` on each line | Referencing specific moments |
| **SRT Subtitles** | Standard `.srt` subtitle file | Video editing, subtitle tools |

### 5. Click "Extract Transcript"

The extension will seek through the entire video to force-load all captions. You'll see the video jumping around — this is normal. Takes roughly **7 seconds for a 90-minute recording**.

### 6. Copy or Download

Once extraction finishes, the transcript appears in the text box. Use:

- **Copy** — Copies to clipboard (paste into ChatGPT, Claude, Google Docs, etc.)
- **Download** — Saves as a `.txt` or `.srt` file

---

## Limitations

- **Captions required.** If the video has no CC track, there is nothing to extract.
- **Possible gaps.** The extension seeks every 5% through the video. For very long recordings, some short caption segments between seek points may be missed. (A future version may add a configurable seek interval.)
- **Skool only.** This extension only activates on `skool.com` pages. It does not work on YouTube, Vimeo, Loom, etc.

---

## Packaging for Distribution

To create a `.zip` file for sharing or uploading to the Chrome Web Store:

```bash
bash package.sh
```

This produces `releases/skool-transcript-extractor-v<version>.zip` (version is read from `manifest.json`). The zip contains only the files Chrome needs — no docs, examples, or dev files.

**What recipients do with the zip:** Unzip it, then follow the [Installation](#installation-step-by-step) steps above, pointing Chrome at the unzipped folder.

> Release zips in `releases/` are **committed to the repo** so anyone can grab a ready-made build. Stray `.zip` files elsewhere in the repo are gitignored.

---

## Updating After Code Changes

When you edit any file in this folder:

1. Go to `chrome://extensions`
2. Find "Skool Transcript Extractor"
3. Click the **refresh icon** (🔄) on the extension card
4. **Also refresh the Skool tab** you're testing on (the content script needs to reload too)

---

## Files

```
manifest.json    — Extension config (permissions, which scripts load where)
content.js       — Injected into Skool pages. Finds videos, extracts captions.
content.css      — Styles for any in-page UI (currently unused/reserved)
popup.html/js/css — The popup UI you see when clicking the extension icon
icons/           — Extension icons (16, 48, 128px)
package.sh       — Creates a clean .zip in releases/ for distribution
releases/        — Ready-made .zip builds (committed to repo)
examples/        — Sample output and screenshots
```

---

## Troubleshooting

**"Could not connect to page. Try refreshing."**
The content script isn't loaded on the current tab. Refresh the Skool page.

**"No video found on this page"**
You're either not on a Skool page, or the page doesn't have a native video recording (embedded YouTube/Vimeo won't work).

**"No caption track available"**
The video exists but has no CC. Check if the video player has a CC button — if it doesn't, the recording was made without captions and there's nothing to extract.

**Transcript has gaps or missing sections**
The 5% seek interval may skip over short segments. Try extracting again — results can vary slightly between runs as cue loading depends on timing.

**Extension doesn't appear after loading**
Make sure Developer Mode is on and you selected the folder containing `manifest.json`, not a parent or child folder.
