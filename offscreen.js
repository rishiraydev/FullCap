// offscreen.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "doStitch") {
    stitchImages(request.data);
    return;
  }
});

async function stitchImages(data) {
  const { screenshots, totalWidth, totalHeight, dpr, clientWidth, clientHeight } = data;
  
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  if (!screenshots || screenshots.length === 0) return;

  const firstImg = await loadImage(screenshots[0].dataUrl);
  const actualImgWidth = firstImg.width;
  const actualImgHeight = firstImg.height;
  
  // Calculate actual scale factors based on the first screenshot.
  const scaleX = actualImgWidth / clientWidth;
  const scaleY = actualImgHeight / clientHeight;

  canvas.width = Math.max(totalWidth * scaleX, actualImgWidth);
  canvas.height = Math.max(totalHeight * scaleY, actualImgHeight);

  // Fill background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentY = 0;

  for (let i = 0; i < screenshots.length; i++) {
    const shot = screenshots[i];
    const img = await loadImage(shot.dataUrl);
    
    const targetY = Math.round(shot.y * scaleY);
    const overlap = Math.max(0, currentY - targetY);
    const sourceHeight = img.height - overlap;
    
    if (sourceHeight > 0) {
      ctx.drawImage(img, 0, overlap, img.width, sourceHeight, 0, currentY, img.width, sourceHeight);
      currentY += sourceHeight;
    }

    // Free image memory immediately after drawing
    img.src = '';
  }

  // Generate final stitched image
  const stitchedDataUrl = canvas.toDataURL("image/png");

  // Clean up canvas memory
  canvas.width = 1;
  canvas.height = 1;
  ctx.clearRect(0, 0, 1, 1);

  // Send back to background
  chrome.runtime.sendMessage({
    action: "processStitchedImage",
    dataUrl: stitchedDataUrl
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for stitching"));
    img.src = src;
  });
}
