# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) that extracts video transcripts/captions from Skool.com's native Mux video player. No build system, no dependencies — plain vanilla JavaScript loaded directly by the browser.

## Development

**Load the extension locally:** Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select this directory.

**Reload after changes:** Click the refresh icon on the extension card in `chrome://extensions`. Content script changes also require refreshing the target Skool page.

**Test manually:** Navigate to a Skool page with a video, open the popup, and click Extract. The content script also exposes `window.SkoolTranscript` for console testing: `SkoolTranscript.extract()`.

There are no tests, linter, or build step.

## Architecture

### Communication Flow

```
popup.js  --chrome.tabs.sendMessage-->  content.js (SkoolTranscript)
         <--sendResponse (async)------
```

The popup sends `{action: 'extract', format}` or `{action: 'status'}` messages. The content script listener returns `true` to keep the message channel open for async responses.

### Content Script (`content.js`)

Single IIFE module `SkoolTranscript` with four responsibilities:

1. **Video Discovery** — `findAllVideos()` recursively traverses shadow DOMs (mux-player → media-theme → mux-video) to locate `<video>` elements. Prefers the video with the most text tracks.

2. **Track Extraction** — `findCaptionTrack()` searches by priority label list (`CONFIG.trackLabels`), then falls back to any subtitles/captions kind track.

3. **Cue Loading** — Two strategies to get all cues:
   - `fetchVTTDirect()` — Finds `<track src>` elements or VTT URLs in the DOM and fetches/parses the VTT file directly.
   - `forceLoadAllCues()` — Seeks the video every 5% through its duration to force lazy-loaded cues to populate. This is the primary method used in `extract()`.

4. **Formatting** — Three output formats: `plain` (deduplicated flowing text), `timestamps` (`[M:SS] text`), `srt` (SRT subtitle format with sequence numbers).

### Popup (`popup.js`, `popup.html`, `popup.css`)

Handles format selection (plain/timestamps/SRT), triggers extraction, displays results, and provides copy-to-clipboard and file download. On open, it calls `checkStatus()` to detect if a video with captions is present.

### Key Constraints

- Mux player uses nested shadow DOMs — any DOM traversal must recurse into `shadowRoot`.
- Caption cues are lazy-loaded by the Mux player; they only populate as the video plays through that segment. The force-seek approach works around this.
- The extension only activates on `https://*.skool.com/*` (defined in `manifest.json` host_permissions and content_scripts matches).
