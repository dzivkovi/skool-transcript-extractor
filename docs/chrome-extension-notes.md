# Chrome Extension Development Notes

Learnings and best practices gathered during development of the Skool Transcript Extractor.

---

## Distribution: How Chrome Extensions Reach Users

### Chrome Web Store (the "normal" way)

When you install an extension from the Chrome Web Store, Chrome downloads a `.crx` file — a signed zip with a special header. The user clicks "Add to Chrome" and it just works. This is why most people never see a zip file or folder.

**Trade-off:** Requires a developer account ($5 one-time fee), a review process, and you must be the extension's author/publisher.

### Load Unpacked (Developer Mode)

The only reliable sideloading method on Windows and macOS since Chrome 75+ blocked unsigned CRX installs. The user enables Developer Mode at `chrome://extensions`, clicks "Load unpacked", and selects a folder containing `manifest.json`.

**Key insight:** Chrome only executes files referenced in `manifest.json`. Extra files in the folder (README, docs, examples, .git) are completely ignored — no performance hit, no bloat in the running extension. So pointing someone at a cloned repo works just as well as a clean zip.

### CRX drag-and-drop (mostly dead)

Since Chrome 75, CRX files must be signed by Google's key. On Windows and macOS, dragging a self-signed CRX onto `chrome://extensions` no longer works. Only viable for enterprise policy installs.

### Enterprise policy push

Extensions can be force-installed via Windows registry or macOS managed preferences. Only relevant for corporate/managed environments.

### Summary table

| Method               | UX               | Platform restriction          | Our use case? |
|----------------------|------------------|-------------------------------|---------------|
| Chrome Web Store     | One-click        | None                          | Future option |
| Load Unpacked        | Manual (3 steps) | Requires Developer Mode       | Primary       |
| CRX drag-and-drop    | Broken           | Blocked on Win/Mac since v75  | No            |
| Enterprise policy    | Transparent      | Managed devices only          | No            |

---

## Packaging: Clean Zip vs. Raw Repo

### When a zip matters

- **Chrome Web Store upload** — requires a zip with only extension files.
- **Non-technical users** — a single zip download is simpler than "clone a git repo".
- **CRX creation** — Chrome's "Pack extension" bundles ALL files in the directory, so a clean folder/zip avoids shipping README, .git, etc. inside the CRX.

### When the raw repo is fine

- **Load Unpacked** — Chrome ignores non-manifest files. A cloned repo with README, examples, and dev scripts in it works perfectly.
- **Developer collaborators** — they'll clone anyway.

### Our approach

We provide both paths:
1. **Clone the repo** and point Chrome at it — works as-is.
2. **`bash package.sh`** generates a clean zip in `releases/` — for sharing with non-git users and for future Web Store upload.

Release zips are committed to the repo (`!releases/*.zip` exception in `.gitignore`) so anyone can grab a ready-made build from GitHub without running the script. Stray `.zip` files elsewhere in the repo are gitignored.

---

## Manifest V3: What It Means for Us

This extension uses Manifest V3 (the current required format). Key implications:

- **No remote code** — all JS must be bundled locally, no CDN script tags.
- **Service workers** — background scripts run as service workers (we don't use one currently, but if we add one, it must be a service worker, not a persistent background page).
- **Content scripts** are still injected the same way as V2.
- **`activeTab`** permission replaces broad tab access for most use cases (which we already use).

---

## Shadow DOM: The Mux Player Challenge

Skool uses the Mux video player, which nests components inside shadow DOMs:

```
mux-player → shadowRoot → media-theme → shadowRoot → mux-video → shadowRoot → <video>
```

Standard `document.querySelector` cannot reach into shadow roots. Any DOM traversal must recursively check `element.shadowRoot` at each level. This is why `content.js` has a custom recursive video discovery function rather than a simple selector.

---

## Caption Lazy-Loading Workaround

Mux only loads caption cues for segments the user has watched. A 90-minute video with CC enabled might only have cues for the first 5 minutes if that's all that was played.

**Our workaround:** Programmatically seek the video to every 5% of its duration, pausing briefly at each point to let cues populate. This forces Chrome/Mux to load all caption data. Takes ~7 seconds for a 90-minute video.

**Known limitation:** The 5% interval may miss very short caption segments that fall between seek points. Finer intervals would be more thorough but slower.
