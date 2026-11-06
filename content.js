// content.js

(function() {
  if (window.fullCapInjected) return;
  window.fullCapInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "initCapture") {
      startCapture();
    }
  });

  async function startCapture() {
    // 1. Setup variables
    const dpr = window.devicePixelRatio || 1;
    
    // Find the actual element that scrolls (handles SPAs with custom scroll containers)
    const scrollEl = findScrollableElement();
    const isWindowScroll = (scrollEl === document.documentElement || scrollEl === document.body);

    // 2. Hide scrollbars, disable smooth scroll, and fix sticky elements
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
        scroll-behavior: auto !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      html, body {
        scroll-behavior: auto !important;
        background-color: white !important;
      }
    `;
    document.head.appendChild(styleEl);

    // Wait for styles to apply before measuring
    await waitReflow(100);

    const clientWidth = isWindowScroll ? window.innerWidth : scrollEl.clientWidth;
    let clientHeight = isWindowScroll ? window.innerHeight : scrollEl.clientHeight;
    
    const scrollWidth = scrollEl.scrollWidth;
    const scrollHeight = scrollEl.scrollHeight;

    // Find and prepare fixed/sticky elements
    const fixedElements = getFixedElements();
    fixedElements.forEach(el => {
      el._originalVisibility = el.style.visibility;
    });

    // Restore original scroll
    const originalScrollX = isWindowScroll ? window.scrollX : scrollEl.scrollLeft;
    const originalScrollY = isWindowScroll ? window.scrollY : scrollEl.scrollTop;

    const screenshots = [];

    // 3. Scroll and Capture Loop
    if (isWindowScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      scrollEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    await waitForScrollSettled(scrollEl, isWindowScroll, 0);

    let isFinished = false;

    while (!isFinished) {
      const actualScrollY = isWindowScroll ? window.scrollY : scrollEl.scrollTop;
      
      // Capture viewport
      let dataUrl;
      try {
        dataUrl = await captureViewport();
      } catch (err) {
        console.error("Capture viewport error", err);
        break;
      }
      
      screenshots.push({
        dataUrl: dataUrl,
        y: actualScrollY
      });

      // After first capture, hide sticky elements so they don't repeat
      if (actualScrollY === 0) {
        fixedElements.forEach(el => {
          el.style.visibility = 'hidden';
        });
      }

      if (actualScrollY + clientHeight >= scrollHeight - 5) {
        isFinished = true;
        break;
      }

      // Re-measure in case browser UI changed
      clientHeight = isWindowScroll ? window.innerHeight : scrollEl.clientHeight;

      // Scroll down by one viewport height
      if (isWindowScroll) {
        window.scrollTo({ top: actualScrollY + clientHeight, left: 0, behavior: 'instant' });
      } else {
        scrollEl.scrollTo({ top: actualScrollY + clientHeight, left: 0, behavior: 'instant' });
      }
      await waitForScrollSettled(scrollEl, isWindowScroll, actualScrollY + clientHeight);
      
      // Update popup progress based on actual scroll position
      const newScrollY = isWindowScroll ? window.scrollY : scrollEl.scrollTop;
      chrome.runtime.sendMessage({ 
        action: "captureProgress", 
        progress: Math.min(100, Math.round(((newScrollY + clientHeight) / scrollHeight) * 100)) 
      });
    }

    // 4. Send to background for stitching
    chrome.runtime.sendMessage({
      action: "stitchScreenshots",
      screenshots: screenshots,
      totalWidth: scrollWidth,
      totalHeight: scrollHeight,
      dpr: dpr,
      clientWidth: clientWidth,
      clientHeight: clientHeight
    });

    // 5. Restore state
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    fixedElements.forEach(el => {
      el.style.visibility = el._originalVisibility;
    });
    
    if (isWindowScroll) {
      window.scrollTo(originalScrollX, originalScrollY);
    } else {
      scrollEl.scrollTo(originalScrollX, originalScrollY);
    }
    
    // Final progress update
    chrome.runtime.sendMessage({ action: "captureProgress", progress: 100 });
  }

  function captureViewport() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "captureViewport" }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.runtime.sendMessage({ action: "captureError", message: chrome.runtime.lastError.message });
          reject(chrome.runtime.lastError);
        } else if (!response || !response.dataUrl) {
          const msg = (response && response.error) ? response.error : "Capture failed, no data returned";
          chrome.runtime.sendMessage({ action: "captureError", message: msg });
          reject(new Error(msg));
        } else {
          resolve(response.dataUrl);
        }
      });
    });
  }

  function waitReflow(ms) {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, ms);
      });
    });
  }

  // Waits until scroll position has settled at targetY (or times out)
  function waitForScrollSettled(scrollEl, isWindowScroll, targetY) {
    return new Promise(resolve => {
      const maxWait = 600;   // max 600ms wait
      const checkInterval = 32; // check every ~2 frames
      let elapsed = 0;
      let lastY = -1;

      const check = () => {
        const currentY = isWindowScroll ? window.scrollY : scrollEl.scrollTop;

        // Settled = scroll position stopped changing AND close to target
        const settled = (Math.abs(currentY - lastY) < 1) && (Math.abs(currentY - targetY) < 2 || targetY === 0);
        lastY = currentY;

        if (settled || elapsed >= maxWait) {
          // Extra frame to let paint flush
          requestAnimationFrame(() => setTimeout(resolve, 50));
        } else {
          elapsed += checkInterval;
          setTimeout(check, checkInterval);
        }
      };

      // Start checking after first frame
      requestAnimationFrame(() => setTimeout(check, checkInterval));
    });
  }

  function findScrollableElement() {
    // 1. Check window/document first
    if (document.documentElement.scrollHeight > window.innerHeight) {
      return document.documentElement;
    }
    if (document.body.scrollHeight > window.innerHeight) {
      return document.body;
    }
    
    // 2. Otherwise find the largest scrollable container on the page
    let largest = null;
    let maxArea = 0;
    
    const elements = document.querySelectorAll('*');
    for (let el of elements) {
      if (el.scrollHeight > el.clientHeight) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          const area = el.clientWidth * el.clientHeight;
          // We only care about main content containers, ignoring small scrollable dropdowns
          if (area > maxArea && area > (window.innerWidth * window.innerHeight * 0.5)) {
            maxArea = area;
            largest = el;
          }
        }
      }
    }
    return largest || document.documentElement;
  }

  function getFixedElements() {
    const fixed = [];
    const elements = document.querySelectorAll('*');
    for (let el of elements) {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        fixed.push(el);
      }
    }
    return fixed;
  }
})();
