/**
 * Skool Transcript Extractor - Popup Script
 * Handles UI interactions and communication with content script
 */

const UI = {
  status: document.getElementById('status'),
  format: document.getElementById('format'),
  extractBtn: document.getElementById('extractBtn'),
  result: document.getElementById('result'),
  resultInfo: document.getElementById('resultInfo'),
  transcript: document.getElementById('transcript'),
  copyBtn: document.getElementById('copyBtn'),
  downloadBtn: document.getElementById('downloadBtn')
};

// ─────────────────────────────────────────────────────────────
// STATUS MANAGEMENT
// ─────────────────────────────────────────────────────────────
function setStatus(message, type = 'info') {
  UI.status.textContent = message;
  UI.status.className = `status ${type}`;
}

function setLoading(loading) {
  UI.extractBtn.disabled = loading;
  UI.extractBtn.textContent = loading ? '⏳ Extracting...' : '⚡ Extract Transcript';
}

// ─────────────────────────────────────────────────────────────
// CONTENT SCRIPT COMMUNICATION
// ─────────────────────────────────────────────────────────────
async function sendToContent(action, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes('skool.com')) {
    throw new Error('Not on a Skool page');
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action, ...data }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error('Could not connect to page. Try refreshing.'));
      } else {
        resolve(response);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// CHECK PAGE STATUS
// ─────────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const status = await sendToContent('status');
    
    if (!status.videoFound) {
      setStatus('No video found on this page', 'warning');
      UI.extractBtn.disabled = true;
    } else if (!status.trackFound) {
      setStatus('Video found, no captions available', 'warning');
      UI.extractBtn.disabled = true;
    } else {
      setStatus(`Ready: ${status.trackLabel || 'Captions'} (${status.cueCount} cues)`, 'success');
      UI.extractBtn.disabled = false;
    }
  } catch (err) {
    setStatus(err.message, 'error');
    UI.extractBtn.disabled = true;
  }
}

// ─────────────────────────────────────────────────────────────
// EXTRACTION
// ─────────────────────────────────────────────────────────────
async function extractTranscript() {
  setLoading(true);
  
  try {
    const format = UI.format.value;
    const response = await sendToContent('extract', { format });

    if (!response.success) {
      throw new Error(response.error);
    }

    displayResult(response, format);
    setStatus('Extraction complete!', 'success');
    
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function displayResult(response, format) {
  const duration = formatDuration(response.duration);
  UI.resultInfo.textContent = `${response.cueCount} cues • ${duration}`;
  UI.transcript.value = response.transcript;
  UI.result.classList.remove('hidden');
  
  // Store for download
  UI.result.dataset.format = format;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// COPY & DOWNLOAD
// ─────────────────────────────────────────────────────────────
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(UI.transcript.value);
    UI.copyBtn.textContent = '✅ Copied!';
    setTimeout(() => UI.copyBtn.textContent = '📋 Copy', 2000);
  } catch (err) {
    UI.copyBtn.textContent = '❌ Failed';
    setTimeout(() => UI.copyBtn.textContent = '📋 Copy', 2000);
  }
}

function downloadTranscript() {
  const text = UI.transcript.value;
  if (!text) {
    UI.downloadBtn.textContent = '❌ No transcript';
    setTimeout(() => UI.downloadBtn.textContent = '💾 Download', 2000);
    return;
  }

  const format = UI.result.dataset.format || 'plain';
  const ext = format === 'srt' ? 'srt' : 'txt';
  const filename = `skool-transcript-${Date.now()}.${ext}`;
  
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  // Create and append to body for reliable click
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // Cleanup after delay
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  UI.downloadBtn.textContent = '✅ Downloaded!';
  setTimeout(() => UI.downloadBtn.textContent = '💾 Download', 2000);
}

// ─────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────
UI.extractBtn.addEventListener('click', extractTranscript);
UI.copyBtn.addEventListener('click', copyToClipboard);
UI.downloadBtn.addEventListener('click', downloadTranscript);

// Initialize
checkStatus();
