document.addEventListener('DOMContentLoaded', () => {
  let canvas;
  let currentMode = 'select';
  let currentColor = '#ff4757';
  let cropRect = null;
  let bgImage = null;
  let fitZoom = 1;
  let isDown = false;
  let origX = 0;
  let origY = 0;
  let tempRect = null;

  // Initialize Canvas from storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['capturedImage', 'exportFormat'], (result) => {
      if (result.capturedImage) {
        initEditor(result.capturedImage, result.exportFormat || 'png');
      } else {
        alert("No image found to edit.");
      }
    });
  }

  function initEditor(dataUrl, defaultFormat) {
    // Initialize Fabric Canvas ONCE
    canvas = new fabric.Canvas('main-canvas', {
      isDrawingMode: false,
      selection: true
    });

    setupCanvasEvents();
    setupToolbar();
    setupHotkeys();

    fabric.Image.fromURL(dataUrl, (img) => {
      displayImage(img);
    });
  }

  function displayImage(img) {
    canvas.clear();
    bgImage = img;

    const dpr = window.devicePixelRatio || 1;
    const availableWidth = Math.max(window.innerWidth - 80, 400);

    // Fit image to screen width if it exceeds available space
    fitZoom = 1 / dpr;
    if (img.width * fitZoom > availableWidth) {
      fitZoom = availableWidth / img.width;
    }

    const finalCssWidth = Math.round(img.width * fitZoom);
    const finalCssHeight = Math.round(img.height * fitZoom);

    canvas.setWidth(finalCssWidth);
    canvas.setHeight(finalCssHeight);
    canvas.setZoom(fitZoom);

    img.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      hoverCursor: 'default'
    });

    canvas.add(img);
    canvas.sendToBack(img);

    window.exportMultiplier = 1 / fitZoom;
    canvas.renderAll();
  }

  function setupToolbar() {
    const tools = {
      'tool-select': 'select',
      'tool-draw': 'draw',
      'tool-rect': 'rect',
      'tool-text': 'text',
      'tool-crop': 'crop'
    };

    // Tool Selection
    for (const [id, mode] of Object.entries(tools)) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          setMode(mode);
        });
      }
    }

    // Color Picker
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        if (canvas && canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = currentColor;
        }

        const activeObj = canvas ? canvas.getActiveObject() : null;
        if (activeObj) {
          if (activeObj.type === 'i-text') {
            activeObj.set('fill', currentColor);
          } else {
            activeObj.set('stroke', currentColor);
          }
          canvas.renderAll();
        }
      });
    }

    // Delete Button
    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteSelected);
    }

    // Export Buttons
    const pngBtn = document.getElementById('btn-export-png');
    if (pngBtn) pngBtn.addEventListener('click', () => exportImage('png'));

    const jpgBtn = document.getElementById('btn-export-jpg');
    if (jpgBtn) jpgBtn.addEventListener('click', () => exportImage('jpeg'));

    const pdfBtn = document.getElementById('btn-export-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', () => exportPdf());
  }

  function setMode(mode) {
    currentMode = mode;
    if (!canvas) return;

    canvas.isDrawingMode = (mode === 'draw');

    if (mode === 'draw') {
      const zoom = canvas.getZoom() || 1;
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = Math.max(2, Math.round(4 / zoom));
    }

    // Remove crop rect if we exit crop mode
    if (mode !== 'crop' && cropRect) {
      canvas.remove(cropRect);
      cropRect = null;
      canvas.renderAll();
    }
  }

  function setupCanvasEvents() {
    canvas.on('mouse:down', function(o) {
      if (currentMode === 'select' || currentMode === 'draw') return;

      const pointer = canvas.getPointer(o.e);
      isDown = true;
      origX = pointer.x;
      origY = pointer.y;

      const zoom = canvas.getZoom() || 1;

      if (currentMode === 'rect') {
        tempRect = new fabric.Rect({
          left: origX,
          top: origY,
          originX: 'left',
          originY: 'top',
          width: 0,
          height: 0,
          angle: 0,
          fill: 'transparent',
          stroke: currentColor,
          strokeWidth: Math.max(2, Math.round(3 / zoom)),
          transparentCorners: false
        });
        canvas.add(tempRect);
      } else if (currentMode === 'text') {
        const text = new fabric.IText('Double click to edit', {
          left: origX,
          top: origY,
          fontFamily: 'Outfit, Inter, sans-serif',
          fill: currentColor,
          fontSize: Math.max(16, Math.round(24 / zoom))
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        setMode('select');
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const selectBtn = document.getElementById('tool-select');
        if (selectBtn) selectBtn.classList.add('active');
        isDown = false;
      } else if (currentMode === 'crop') {
        if (cropRect) canvas.remove(cropRect);
        cropRect = new fabric.Rect({
          left: origX,
          top: origY,
          originX: 'left',
          originY: 'top',
          width: 0,
          height: 0,
          fill: 'rgba(0, 0, 0, 0.35)',
          stroke: '#6366f1',
          strokeWidth: Math.max(1, Math.round(2 / zoom)),
          strokeDashArray: [6 / zoom, 6 / zoom],
          selectable: false,
          evented: false
        });
        canvas.add(cropRect);
      }
    });

    canvas.on('mouse:move', function(o) {
      if (!isDown) return;
      const pointer = canvas.getPointer(o.e);

      if (currentMode === 'rect' && tempRect) {
        tempRect.set({
          left: Math.min(origX, pointer.x),
          top: Math.min(origY, pointer.y),
          width: Math.abs(origX - pointer.x),
          height: Math.abs(origY - pointer.y)
        });
        canvas.renderAll();
      } else if (currentMode === 'crop' && cropRect) {
        cropRect.set({
          left: Math.min(origX, pointer.x),
          top: Math.min(origY, pointer.y),
          width: Math.abs(origX - pointer.x),
          height: Math.abs(origY - pointer.y)
        });
        canvas.renderAll();
      }
    });

    canvas.on('mouse:up', function() {
      if (!isDown) return;
      isDown = false;

      if (currentMode === 'rect' && tempRect) {
        if (tempRect.width < 5 && tempRect.height < 5) {
          canvas.remove(tempRect);
        } else {
          tempRect.setCoords();
          canvas.setActiveObject(tempRect);
          setMode('select');
          document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
          const selectBtn = document.getElementById('tool-select');
          if (selectBtn) selectBtn.classList.add('active');
        }
        tempRect = null;
      } else if (currentMode === 'crop' && cropRect) {
        if (cropRect.width > 20 && cropRect.height > 20) {
          applyCrop();
        } else {
          canvas.remove(cropRect);
          cropRect = null;
          setMode('select');
          document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
          const selectBtn = document.getElementById('tool-select');
          if (selectBtn) selectBtn.classList.add('active');
        }
      }
    });
  }

  function applyCrop() {
    const cropX = Math.round(cropRect.left);
    const cropY = Math.round(cropRect.top);
    const cropW = Math.round(cropRect.width);
    const cropH = Math.round(cropRect.height);

    canvas.remove(cropRect);
    cropRect = null;

    if (cropW < 20 || cropH < 20) {
      setMode('select');
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      const selectBtn = document.getElementById('tool-select');
      if (selectBtn) selectBtn.classList.add('active');
      return;
    }

    const zoom = canvas.getZoom() || 1;

    // Convert canvas to data url for cropped area
    const croppedData = canvas.toDataURL({
      left: cropX * zoom,
      top: cropY * zoom,
      width: cropW * zoom,
      height: cropH * zoom,
      format: 'png',
      multiplier: window.exportMultiplier || 1
    });

    fabric.Image.fromURL(croppedData, (newImg) => {
      displayImage(newImg);
    });

    setMode('select');
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    const selectBtn = document.getElementById('tool-select');
    if (selectBtn) selectBtn.classList.add('active');
  }

  function deleteSelected() {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
      canvas.discardActiveObject();
      activeObjects.forEach(function(object) {
        if (object !== bgImage) {
          canvas.remove(object);
        }
      });
      canvas.renderAll();
    }
  }

  function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (!canvas) return;
      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.isEditing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        return;
      }

      const keyMap = {
        'v': 'tool-select',
        'b': 'tool-draw',
        'r': 'tool-rect',
        't': 'tool-text',
        'c': 'tool-crop'
      };

      const toolId = keyMap[e.key.toLowerCase()];
      if (toolId) {
        const btn = document.getElementById(toolId);
        if (btn) btn.click();
      }
    });
  }

  function exportImage(format) {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({
      format: format,
      quality: format === 'jpeg' ? 0.92 : 1,
      multiplier: window.exportMultiplier || 1
    });

    const ext = format === 'jpeg' ? 'jpg' : format;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `FullCap-Screenshot-${timestamp}.${ext}`;

    downloadURI(dataUrl, filename);
  }

  function exportPdf() {
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();

    const jsPdfConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfConstructor) {
      alert("PDF library is not loaded.");
      return;
    }

    const width = Math.round(canvas.width * (window.exportMultiplier || 1));
    const height = Math.round(canvas.height * (window.exportMultiplier || 1));

    const pdf = new jsPdfConstructor({
      orientation: width > height ? 'l' : 'p',
      unit: 'px',
      format: [width, height]
    });

    const imgData = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.95,
      multiplier: window.exportMultiplier || 1
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, width, height);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    pdf.save(`FullCap-Screenshot-${timestamp}.pdf`);
  }

  function downloadURI(uri, name) {
    const link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
});
