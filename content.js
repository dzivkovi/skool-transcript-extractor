/**
 * Skool Transcript Extractor - Content Script
 * Extracts captions from Skool's Mux video player via textTracks API
 * 
 * Architecture: SRP-compliant modules for discovery, extraction, formatting
 */

const SkoolTranscript = (() => {
  // ─────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────
  const CONFIG = {
    selectors: {
      muxPlayer: 'mux-player',
      muxVideo: 'mux-video',
      videoElement: 'video',
      shadowRoots: ['mux-player', 'media-theme', 'mux-video']
    },
    trackLabels: ['English CC', 'English', 'en', 'captions', 'subtitles'],
    retryAttempts: 3,
    retryDelay: 500
  };

  // ─────────────────────────────────────────────────────────────
  // VIDEO DISCOVERY (Single Responsibility: Find the video element)
  // ─────────────────────────────────────────────────────────────
  function findAllVideos(root = document, depth = 0) {
    const videos = [];
    
    root.querySelectorAll('video').forEach(v => {
      videos.push({element: v, depth, tracks: v.textTracks?.length || 0});
    });
    
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) {
        videos.push(...findAllVideos(el.shadowRoot, depth + 1));
      }
    });
    
    return videos;
  }

  function findVideoElement() {
    const allVideos = findAllVideos();
    if (allVideos.length === 0) return null;
    
    // Prefer video with most text tracks
    allVideos.sort((a, b) => b.tracks - a.tracks);
    return allVideos[0].element;
  }

  // ─────────────────────────────────────────────────────────────
  // TRACK EXTRACTION (Single Responsibility: Get caption track)
  // ─────────────────────────────────────────────────────────────
  function findCaptionTrack(video) {
    const tracks = video.textTracks;
    if (!tracks?.length) return null;

    // Priority search by known labels
    for (const label of CONFIG.trackLabels) {
      for (const track of tracks) {
        if (track.label?.toLowerCase().includes(label.toLowerCase()) ||
            track.language?.toLowerCase() === label.toLowerCase()) {
          return track;
        }
      }
    }

    // Fallback: first available track with cues
    for (const track of tracks) {
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        return track;
      }
    }

    return tracks[0] || null;
  }

  function findTrackElement(video) {
    // Search for <track> element with src attribute
    const trackEl = video.querySelector('track[src]');
    if (trackEl?.src) return trackEl;

    // Search in parent shadow roots for track elements
    let parent = video.parentElement;
    while (parent) {
      const track = parent.querySelector('track[src]');
      if (track?.src) return track;
      parent = parent.parentElement;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // VTT DIRECT FETCH (Bypasses lazy-loading completely)
  // ─────────────────────────────────────────────────────────────
  async function fetchVTTDirect(video) {
    // Method 1: Find track element with src
    const trackEl = findTrackElement(video);
    if (trackEl?.src) {
      try {
        const response = await fetch(trackEl.src);
        if (response.ok) {
          const vttText = await response.text();
          return parseVTT(vttText);
        }
      } catch (e) {
        console.log('[Skool Transcript] Track src fetch failed:', e);
      }
    }

    // Method 2: Search network requests for VTT URL patterns
    // Check for Mux VTT URL pattern in page
    const vttUrls = findVTTUrls();
    for (const url of vttUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const vttText = await response.text();
          const cues = parseVTT(vttText);
          if (cues.length > 0) return cues;
        }
      } catch (e) {
        console.log('[Skool Transcript] VTT URL fetch failed:', url, e);
      }
    }

    return null;
  }

  function findVTTUrls() {
    const urls = [];
    
    // Search all elements for VTT-related URLs
    const allElements = document.querySelectorAll('*');
    const vttPattern = /https?:\/\/[^\s"']+\.vtt/gi;
    
    for (const el of allElements) {
      // Check src attributes
      if (el.src && el.src.includes('.vtt')) {
        urls.push(el.src);
      }
      // Check data attributes
      for (const attr of el.attributes || []) {
        const matches = attr.value.match(vttPattern);
        if (matches) urls.push(...matches);
      }
    }

    // Search shadow DOMs
    const shadowHosts = document.querySelectorAll('mux-player, media-theme, mux-video');
    for (const host of shadowHosts) {
      if (host.shadowRoot) {
        const tracks = host.shadowRoot.querySelectorAll('track[src]');
        for (const track of tracks) {
          if (track.src) urls.push(track.src);
        }
      }
    }

    return [...new Set(urls)];
  }

  function parseVTT(vttText) {
    const cues = [];
    const lines = vttText.split('\n');
    let currentCue = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Timestamp line: 00:00:00.000 --> 00:00:00.000
      const timeMatch = line.match(/(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})\.(\d{3})/);
      if (timeMatch) {
        if (currentCue && currentCue.text) {
          cues.push(currentCue);
        }
        currentCue = {
          start: parseVTTTime(timeMatch[0].split('-->')[0].trim()),
          end: parseVTTTime(timeMatch[0].split('-->')[1].trim()),
          text: ''
        };
        continue;
      }

      // Text line (part of current cue)
      if (currentCue && line && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !line.match(/^\d+$/)) {
        currentCue.text += (currentCue.text ? ' ' : '') + cleanCueText(line);
      }
    }

    // Don't forget the last cue
    if (currentCue && currentCue.text) {
      cues.push(currentCue);
    }

    return cues;
  }

  function parseVTTTime(timeStr) {
    const parts = timeStr.split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
      seconds += parseInt(parts[0]) * 3600;
      seconds += parseInt(parts[1]) * 60;
      seconds += parseFloat(parts[2]);
    } else if (parts.length === 2) {
      seconds += parseInt(parts[0]) * 60;
      seconds += parseFloat(parts[1]);
    }
    
    return seconds;
  }

  async function activateTrack(track) {
    if (!track) return false;
    
    const originalMode = track.mode;
    track.mode = 'showing';

    // Wait for cues to load
    if (!track.cues?.length) {
      await new Promise(resolve => {
        const handler = () => {
          track.removeEventListener('cuechange', handler);
          resolve();
        };
        track.addEventListener('cuechange', handler);
        setTimeout(resolve, 1000); // Timeout fallback
      });
    }

    return track.cues?.length > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // FORCE LOAD ALL CUES (Seek method as fallback)
  // ─────────────────────────────────────────────────────────────
  async function forceLoadAllCues(video, track) {
    if (!video || !track) return false;

    const originalTime = video.currentTime;
    const duration = video.duration;

    if (!duration || !isFinite(duration)) return false;

    track.mode = 'showing';

    // Seek every 5% through video - proven working pattern
    const points = [];
    for (let i = 0; i <= 100; i += 5) {
      points.push(duration * i / 100);
    }
    
    console.log(`[Skool Transcript] Seeking through ${points.length} points (${Math.round(duration)}s video)...`);
    
    for (const point of points) {
      video.currentTime = point;
      await new Promise(r => setTimeout(r, 300));
      console.log(`[Skool Transcript] ${Math.round(point)}s - cues: ${track.cues?.length || 0}`);
    }

    // Restore original position
    video.currentTime = originalTime;

    console.log(`[Skool Transcript] Force-load complete. Total cues: ${track.cues?.length || 0}`);
    return track.cues?.length > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // CUE PROCESSING (Single Responsibility: Extract and clean cues)
  // ─────────────────────────────────────────────────────────────
  function formatTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return h > 0 
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function cleanCueText(text) {
    return text
      .replace(/<[^>]*>/g, '')           // Remove HTML tags
      .replace(/\n+/g, ' ')              // Normalize newlines
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();
  }

  function extractCues(track) {
    if (!track?.cues?.length) return [];

    const cues = [];
    for (const cue of track.cues) {
      const text = cleanCueText(cue.text);
      if (text) {
        cues.push({
          start: cue.startTime,
          end: cue.endTime,
          text: text
        });
      }
    }
    return cues;
  }

  // ─────────────────────────────────────────────────────────────
  // OUTPUT FORMATTING (Single Responsibility: Format for export)
  // ─────────────────────────────────────────────────────────────
  function formatAsPlainText(cues) {
    // Deduplicate consecutive identical lines
    const lines = [];
    let lastText = '';
    
    for (const cue of cues) {
      if (cue.text !== lastText) {
        lines.push(cue.text);
        lastText = cue.text;
      }
    }
    
    return lines.join(' ');
  }

  function formatWithTimestamps(cues) {
    const lines = [];
    let lastText = '';
    
    for (const cue of cues) {
      if (cue.text !== lastText) {
        lines.push(`[${formatTimestamp(cue.start)}] ${cue.text}`);
        lastText = cue.text;
      }
    }
    
    return lines.join('\n');
  }

  function formatAsSRT(cues) {
    const srtLines = [];
    let index = 1;
    let lastText = '';
    
    for (const cue of cues) {
      if (cue.text !== lastText) {
        const startTime = formatSRTTimestamp(cue.start);
        const endTime = formatSRTTimestamp(cue.end);
        srtLines.push(`${index}\n${startTime} --> ${endTime}\n${cue.text}\n`);
        index++;
        lastText = cue.text;
      }
    }
    
    return srtLines.join('\n');
  }

  function formatSRTTimestamp(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API (Encapsulation: Single entry point)
  // ─────────────────────────────────────────────────────────────
  async function extract(format = 'plain') {
    const video = findVideoElement();
    if (!video) {
      return { success: false, error: 'No video element found on page' };
    }

    console.log('[Skool Transcript] Video found, searching for caption track...');

    const track = findCaptionTrack(video);
    if (!track) {
      return { success: false, error: 'No caption track available' };
    }

    console.log(`[Skool Transcript] Found track: "${track.label}", current cues: ${track.cues?.length || 0}`);

    // Always force-load to get ALL cues
    await forceLoadAllCues(video, track);

    const cues = extractCues(track);
    if (!cues || !cues.length) {
      return { success: false, error: 'Could not extract captions. Try enabling CC first.' };
    }

    let transcript;
    switch (format) {
      case 'timestamps':
        transcript = formatWithTimestamps(cues);
        break;
      case 'srt':
        transcript = formatAsSRT(cues);
        break;
      default:
        transcript = formatAsPlainText(cues);
    }

    return {
      success: true,
      transcript,
      cueCount: cues.length,
      duration: cues[cues.length - 1]?.end || 0
    };
  }

  function getStatus() {
    const video = findVideoElement();
    const track = video ? findCaptionTrack(video) : null;
    
    return {
      videoFound: !!video,
      trackFound: !!track,
      trackLabel: track?.label || null,
      cueCount: track?.cues?.length || 0
    };
  }

  return { extract, getStatus, CONFIG };
})();

// ─────────────────────────────────────────────────────────────
// MESSAGE HANDLING (Separation of Concerns: Communication layer)
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    SkoolTranscript.extract(request.format || 'plain')
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'status') {
    sendResponse(SkoolTranscript.getStatus());
    return false;
  }
});

// Expose for console testing
window.SkoolTranscript = SkoolTranscript;
console.log('[Skool Transcript Extractor] Ready. Test with: SkoolTranscript.extract()');
