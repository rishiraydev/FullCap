// background.js

let captureInProgress = false;
let captureTimeoutId = null;

// Create the offscreen document if it doesn't exist
async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['DOM_PARSER'],
    justification: 'Stitching multiple screenshots into one canvas.'
  });
}

// Reset capture lock (safety: auto-reset after 30s if something crashes)
function resetCaptureLock() {
  captureInProgress = false;
  if (captureTimeoutId) {
    clearTimeout(captureTimeoutId);
    captureTimeoutId = null;
  }
}

// Trigger capture when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (captureInProgress) return;
  captureInProgress = true;

  // Safety timeout: reset lock after 30 seconds if capture never completes
  captureTimeoutId = setTimeout(() => {
    console.warn("FullCap: Capture timed out, resetting lock.");
    resetCaptureLock();
  }, 30000);

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }).then(() => {
    chrome.tabs.sendMessage(tab.id, { action: "initCapture" });
  }).catch(err => {
    console.error("FullCap: Script injection failed (restricted page).", err);
    resetCaptureLock();
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureVisibleArea") {
    // MV3: no null first arg
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("FullCap: captureVisibleArea error:", chrome.runtime.lastError);
        return;
      }
      openEditor(dataUrl);
    });
    return;
  }

  if (request.action === "captureViewport") {
    // MV3: no null first arg
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ dataUrl: dataUrl });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "captureError") {
    // content.js reported a fatal error — release the lock
    console.error("FullCap: Capture error from content script:", request.message);
    resetCaptureLock();
    return;
  }

  if (request.action === "processStitchedImage") {
    resetCaptureLock();
    openEditor(request.dataUrl);
    return;
  }

  if (request.action === "stitchScreenshots") {
    processScreenshots(request);
    return;
  }
});

// Forward screenshots to offscreen document for stitching
async function processScreenshots(data) {
  try {
    await setupOffscreenDocument('offscreen.html');
    chrome.runtime.sendMessage({ action: "doStitch", data: data });
  } catch (err) {
    console.error("FullCap: Failed to setup offscreen document.", err);
    resetCaptureLock();
  }
}

function openEditor(dataUrl) {
  // Try to store; if quota exceeded, compress to JPEG first
  chrome.storage.local.set({ capturedImage: dataUrl }, () => {
    if (chrome.runtime.lastError) {
      console.warn("FullCap: PNG storage quota hit, retrying as JPEG...", chrome.runtime.lastError);
      compressToJpeg(dataUrl, (compressedUrl) => {
        chrome.storage.local.set({ capturedImage: compressedUrl }, () => {
          if (chrome.runtime.lastError) {
            console.error("FullCap: Storage failed even after JPEG compression.", chrome.runtime.lastError);
            return;
          }
          openEditorTab();
        });
      });
      return;
    }
    openEditorTab();
  });
}

function openEditorTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.create({ url: chrome.runtime.getURL("editor.html"), index: tabs[0].index + 1 });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
    }
  });
}

// Compress a PNG data URL to JPEG using OffscreenCanvas
function compressToJpeg(dataUrl, callback) {
  try {
    const img = new Image();
    img.onload = () => {
      const oc = new OffscreenCanvas(img.width, img.height);
      const ctx = oc.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      oc.convertToBlob({ type: 'image/jpeg', quality: 0.88 }).then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => callback(reader.result);
        reader.readAsDataURL(blob);
      });
    };
    img.onerror = () => callback(dataUrl); // fallback: original
    img.src = dataUrl;
  } catch (e) {
    callback(dataUrl); // fallback: original
  }
}
