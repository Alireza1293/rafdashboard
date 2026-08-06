(() => {
  'use strict';

  const formats = {
    original: { width: 1080, height: 1080, label: 'ابعاد اصلی' },
    post: { width: 1080, height: 1350, label: 'پست' },
    story: { width: 1080, height: 1920, label: 'استوری' },
    square: { width: 1080, height: 1080, label: 'مربع' }
  };
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const state = {
    photo: null,
    logo: null,
    photoName: 'raf-product',
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    pointerStartX: 0,
    pointerStartY: 0,
    offsetStartX: 0,
    offsetStartY: 0,
    dragTarget: 'photo',
    hitAreas: [],
    guides: [],
    elementOffsets: {
      logo: { x: 0, y: 0 },
      handle: { x: 0, y: 0 },
      faTitle: { x: 0, y: 0 },
      enTitle: { x: 0, y: 0 }
    },
    format: 'original'
  };

  const number = (id) => Number($(id).value) || 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const persianNumber = (value) => new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);
  const dimensions = () => {
    if (state.format === 'original' && state.photo) {
      return { width: state.photo.width, height: state.photo.height, label: 'ابعاد اصلی' };
    }
    return formats[state.format];
  };
  const layoutScale = () => dimensions().width / 1080;
  const outputName = () => `${dimensions().width}x${dimensions().height}`;

  function fitCanvasShell() {
    const shell = $('canvasShell');
    const stage = shell.parentElement;
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const { width, height } = dimensions();
    const ratio = width / height;
    let fittedWidth = availableWidth;
    let fittedHeight = fittedWidth / ratio;
    if (fittedHeight > availableHeight) {
      fittedHeight = availableHeight;
      fittedWidth = fittedHeight * ratio;
    }
    fittedWidth = Math.floor(fittedWidth);
    fittedHeight = Math.floor(fittedHeight);
    if (parseFloat(shell.style.width) === fittedWidth && parseFloat(shell.style.height) === fittedHeight) return;
    shell.style.width = `${fittedWidth}px`;
    shell.style.height = `${fittedHeight}px`;
  }
  function elementPosition(id, x, y) {
    const offset = state.elementOffsets[id];
    const scale = layoutScale();
    return { x: x + offset.x * scale, y: y + offset.y * scale };
  }

  function addHitArea(id, x, y, width, height) {
    const padding = 12 * layoutScale();
    state.hitAreas.push({
      id,
      x: x - padding,
      y: y - padding,
      width: width + padding * 2,
      height: height + padding * 2,
      visual: { x, y, width, height }
    });
  }

  function hitTarget(point) {
    return [...state.hitAreas].reverse().find((area) =>
      point.x >= area.x && point.x <= area.x + area.width &&
      point.y >= area.y && point.y <= area.y + area.height
    )?.id || 'photo';
  }

  function keepElementInside(id) {
    const area = state.hitAreas.find((candidate) => candidate.id === id);
    if (!area) return false;
    const { width: W, height: H } = dimensions();
    let dx = 0;
    let dy = 0;
    if (area.x < 0) dx = -area.x;
    if (area.x + area.width > W) dx = W - area.x - area.width;
    if (area.y < 0) dy = -area.y;
    if (area.y + area.height > H) dy = H - area.y - area.height;
    if (!dx && !dy) return false;
    const offset = state.elementOffsets[id];
    const scale = layoutScale();
    offset.x += dx / scale;
    offset.y += dy / scale;
    return true;
  }

  function closestSnap(points, targets, threshold) {
    let match = null;
    points.forEach((point) => {
      targets.forEach((target) => {
        const distance = target - point;
        if (Math.abs(distance) <= threshold && (!match || Math.abs(distance) < Math.abs(match.distance))) {
          match = { distance, target };
        }
      });
    });
    return match;
  }

  function snapPhotoToCanvas() {
    const { width: W, height: H } = dimensions();
    const threshold = 10 * layoutScale();
    state.guides = [];
    if (Math.abs(state.offsetX) <= threshold) {
      state.offsetX = 0;
      state.guides.push({ axis: 'x', position: W / 2 });
    }
    if (Math.abs(state.offsetY) <= threshold) {
      state.offsetY = 0;
      state.guides.push({ axis: 'y', position: H / 2 });
    }
  }

  function snapElement(id) {
    const active = state.hitAreas.find((area) => area.id === id);
    if (!active) return false;
    const { width: W, height: H } = dimensions();
    const threshold = 10 * layoutScale();
    const xTargets = [0, W / 2, W];
    const yTargets = [0, H / 2, H];

    state.hitAreas.forEach((area) => {
      if (area.id === id) return;
      const box = area.visual;
      xTargets.push(box.x, box.x + box.width / 2, box.x + box.width);
      yTargets.push(box.y, box.y + box.height / 2, box.y + box.height);
    });

    const box = active.visual;
    const xSnap = closestSnap([box.x, box.x + box.width / 2, box.x + box.width], xTargets, threshold);
    const ySnap = closestSnap([box.y, box.y + box.height / 2, box.y + box.height], yTargets, threshold);
    state.guides = [];
    const offset = state.elementOffsets[id];
    const scale = layoutScale();
    if (xSnap) {
      offset.x += xSnap.distance / scale;
      state.guides.push({ axis: 'x', position: xSnap.target });
    }
    if (ySnap) {
      offset.y += ySnap.distance / scale;
      state.guides.push({ axis: 'y', position: ySnap.target });
    }
    return Boolean(xSnap || ySnap);
  }

  function drawGuides() {
    if (!state.guides.length) return;
    const { width: W, height: H } = dimensions();
    const scale = layoutScale();
    ctx.save();
    ctx.strokeStyle = 'rgba(39, 201, 130, .95)';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.setLineDash([8 * scale, 6 * scale]);
    state.guides.forEach((guide) => {
      ctx.beginPath();
      if (guide.axis === 'x') {
        ctx.moveTo(guide.position, 0);
        ctx.lineTo(guide.position, H);
      } else {
        ctx.moveTo(0, guide.position);
        ctx.lineTo(W, guide.position);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  function applyFormat() {
    const { width, height, label } = dimensions();
    canvas.width = width;
    canvas.height = height;
    $('canvasMeta').textContent = state.format === 'original' && !state.photo
      ? 'ابعاد اصلی'
      : `${persianNumber(width)} × ${persianNumber(height)}`;
    document.querySelector('.step-badge').textContent = state.format === 'original'
      ? 'اصل'
      : state.format === 'square' ? '۱:۱' : state.format === 'post' ? '۴:۵' : '۹:۱۶';
    $('downloadBtn').setAttribute('aria-label', `دانلود PNG ${label}`);
    constrainOffsets();
    requestAnimationFrame(fitCanvasShell);
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setStatus(title, message, warning = false) {
    const status = $('status');
    status.classList.toggle('warning', warning);
    status.querySelector('strong').textContent = title;
    status.querySelector('small').textContent = message;
  }

  async function fileToImage(fileOrUrl) {
    if (typeof fileOrUrl === 'string') {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = fileOrUrl;
      });
    }

    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(fileOrUrl, { imageOrientation: 'from-image' }); }
      catch (_) { /* Safari fallback below */ }
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(fileOrUrl);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('خواندن تصویر ناموفق بود.')); };
      image.src = url;
    });
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = clamp(radius, 0, Math.min(width, height) / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function photoGeometry() {
    if (!state.photo) return null;
    const { width: W, height: H } = dimensions();
    const baseScale = Math.max(W / state.photo.width, H / state.photo.height);
    const scale = baseScale * state.zoom;
    return {
      width: state.photo.width * scale,
      height: state.photo.height * scale
    };
  }

  function constrainOffsets() {
    const geometry = photoGeometry();
    if (!geometry) return;
    const { width: W, height: H } = dimensions();
    // When the photo is larger, keep the canvas covered. When it is smaller
    // after zooming out, keep the whole photo inside the canvas while still
    // allowing it to be positioned anywhere in the available space.
    const maxX = Math.abs(geometry.width - W) / 2;
    const maxY = Math.abs(geometry.height - H) / 2;
    state.offsetX = clamp(state.offsetX, -maxX, maxX);
    state.offsetY = clamp(state.offsetY, -maxY, maxY);
  }

  function drawPhoto() {
    ctx.fillStyle = '#efede7';
    const { width: W, height: H } = dimensions();
    ctx.fillRect(0, 0, W, H);
    if (!state.photo) return;
    const geometry = photoGeometry();
    const x = (W - geometry.width) / 2 + state.offsetX;
    const y = (H - geometry.height) / 2 + state.offsetY;
    ctx.save();
    ctx.filter = `brightness(${number('brightness')}%) contrast(${number('contrast')}%) saturate(${number('saturation')}%)`;
    ctx.drawImage(state.photo, x, y, geometry.width, geometry.height);
    ctx.restore();
  }

  function drawFrame() {
    const scale = layoutScale();
    const inset = number('borderInset') * scale;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${clamp(number('borderOpacity') / 100, 0, 1)})`;
    ctx.lineWidth = Math.max(1, number('borderWidth') * scale);
    const { width: W, height: H } = dimensions();
    roundedRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, number('borderRadius') * scale);
    ctx.stroke();
    ctx.restore();
  }

  function drawLogo() {
    if (!state.logo) return;
    const { width: W } = dimensions();
    const scale = layoutScale();
    const width = number('logoWidth') * scale;
    const height = width * state.logo.height / state.logo.width;
    const position = elementPosition('logo', W * 0.065, W * 0.063);
    ctx.save();
    ctx.globalAlpha = clamp(number('logoOpacity') / 100, 0, 1);
    ctx.drawImage(state.logo, position.x, position.y, width, height);
    ctx.restore();
    addHitArea('logo', position.x, position.y, width, height);
  }

  function setTextShadow() {
    if (!$('textShadow').checked) return;
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
  }

  function drawText() {
    const { width: W, height: H } = dimensions();
    const scale = layoutScale();
    const handle = $('handle').value.trim();
    const faTitle = $('faTitle').value.trim();
    const enTitle = $('enTitle').value.trim();

    if (handle) {
      ctx.save();
      ctx.globalAlpha = .28;
      ctx.fillStyle = '#272b27';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.direction = 'ltr';
      ctx.font = `500 ${22 * scale}px Dana, Arial, sans-serif`;
      const position = elementPosition('handle', W * 0.067, W * 0.17);
      const metrics = ctx.measureText(handle);
      ctx.fillText(handle, position.x, position.y);
      ctx.restore();
      addHitArea('handle', position.x, position.y - 22 * scale, metrics.width, 28 * scale);
    }

    if (faTitle) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.direction = 'rtl';
      const fontSize = number('faTitleSize') * scale;
      ctx.font = `600 ${fontSize}px Dana, Tahoma, sans-serif`;
      const position = elementPosition('faTitle', W - 83 * scale, H - 128 * scale);
      const metrics = ctx.measureText(faTitle);
      setTextShadow();
      ctx.fillText(faTitle, position.x, position.y);
      ctx.restore();
      addHitArea('faTitle', position.x - metrics.width, position.y - fontSize, metrics.width, fontSize * 1.25);
    }

    if (enTitle) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.direction = 'rtl';
      const fontSize = number('enTitleSize') * scale;
      ctx.font = `500 ${fontSize}px Dana, Tahoma, sans-serif`;
      const position = elementPosition('enTitle', W - 83 * scale, H - 83 * scale);
      const metrics = ctx.measureText(enTitle);
      setTextShadow();
      ctx.fillText(enTitle, position.x, position.y);
      ctx.restore();
      addHitArea('enTitle', position.x - metrics.width, position.y - fontSize, metrics.width, fontSize * 1.3);
    }
  }

  function updateStatus() {
    if (!state.photo) {
      setStatus('آماده‌ی شروع', 'عکس‌ها فقط در مرورگر شما پردازش می‌شوند.');
      return;
    }
    const warnings = [];
    const scale = layoutScale();
    ctx.save();
    ctx.font = `600 ${number('faTitleSize') * scale}px Dana, Tahoma, sans-serif`;
    if (ctx.measureText($('faTitle').value.trim()).width > 430 * scale) warnings.push('عنوان فارسی بلند است.');
    ctx.font = `500 ${number('enTitleSize') * scale}px Dana, Tahoma, sans-serif`;
    if (ctx.measureText($('enTitle').value.trim()).width > 360 * scale) warnings.push('مدل محصول بلند است.');
    ctx.restore();
    if (warnings.length) setStatus('نیاز به بررسی', warnings.join(' '), true);
    else setStatus('خروجی آماده است', 'برای دریافت تصویر باکیفیت، روی «دانلود PNG» بزن.');
  }

  function render() {
    const { width: W, height: H } = dimensions();
    state.hitAreas = [];
    ctx.clearRect(0, 0, W, H);
    drawPhoto();
    if (state.photo) {
      drawFrame();
      drawLogo();
      drawText();
      drawGuides();
    }
    updateStatus();
  }

  async function usePhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('لطفاً یک فایل تصویری معتبر انتخاب کن.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast('حجم تصویر باید کمتر از ۲۰ مگابایت باشد.');
      return;
    }
    try {
      setStatus('در حال پردازش…', 'چند لحظه صبر کن.');
      state.photo = await fileToImage(file);
      state.photoName = file.name.replace(/\.[^.]+$/, '') || 'raf-product';
      state.zoom = 1;
      state.offsetX = 0;
      state.offsetY = 0;
      $('zoom').value = '1';
      $('photoLabel').textContent = file.name;
      $('emptyState').classList.add('hidden');
      $('downloadBtn').disabled = false;
      applyFormat();
      updateRanges();
      render();
    } catch (_) {
      setStatus('خطا در خواندن فایل', 'یک تصویر دیگر را امتحان کن.', true);
    }
  }

  async function useLogo(file) {
    if (!file) return;
    try {
      state.logo = await fileToImage(file);
      const url = URL.createObjectURL(file);
      $('logoThumb').src = url;
      $('logoThumb').onload = () => URL.revokeObjectURL(url);
      render();
      showToast('لوگوی جدید جایگزین شد.');
    } catch (_) { showToast('خواندن لوگو ناموفق بود.'); }
  }

  function updateRanges() {
    const definitions = [
      ['zoom', 'zoomOut', (v) => `${persianNumber(v.toFixed(2))}×`],
      ['brightness', 'brightnessOut', (v) => `${persianNumber(Math.round(v))}٪`],
      ['contrast', 'contrastOut', (v) => `${persianNumber(Math.round(v))}٪`],
      ['saturation', 'saturationOut', (v) => `${persianNumber(Math.round(v))}٪`]
    ];
    definitions.forEach(([id, outputId, format]) => {
      const input = $(id);
      const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
      input.style.setProperty('--fill', `${progress}%`);
      $(outputId).value = format(Number(input.value));
    });
  }

  $('photoInput').addEventListener('change', (event) => usePhoto(event.target.files[0]));
  $('logoInput').addEventListener('change', (event) => useLogo(event.target.files[0]));

  ['zoom', 'brightness', 'contrast', 'saturation'].forEach((id) => {
    $(id).addEventListener('input', () => {
      if (id === 'zoom') {
        state.zoom = Number($('zoom').value);
        constrainOffsets();
      }
      updateRanges();
      render();
    });
  });

  ['faTitle', 'enTitle', 'handle', 'borderInset', 'borderRadius', 'borderWidth', 'borderOpacity', 'logoWidth', 'logoOpacity', 'faTitleSize', 'enTitleSize', 'textShadow'].forEach((id) => {
    $(id).addEventListener('input', render);
    $(id).addEventListener('change', render);
  });

  document.querySelectorAll('input[name="format"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.format = input.value;
      applyFormat();
      render();
    });
  });

  document.querySelectorAll('[data-section]').forEach((section) => {
    const button = section.querySelector('.section-toggle');
    button.addEventListener('click', () => {
      const open = section.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  const dropTargets = [$('photoDropzone'), $('canvasShell')];
  dropTargets.forEach((target) => {
    ['dragenter', 'dragover'].forEach((eventName) => target.addEventListener(eventName, (event) => {
      event.preventDefault();
      $('photoDropzone').classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((eventName) => target.addEventListener(eventName, (event) => {
      event.preventDefault();
      $('photoDropzone').classList.remove('dragover');
    }));
    target.addEventListener('drop', (event) => usePhoto(event.dataTransfer.files[0]));
  });

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * dimensions().width / rect.width,
      y: (event.clientY - rect.top) * dimensions().height / rect.height
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.photo) return;
    const point = canvasPoint(event);
    canvas.setPointerCapture(event.pointerId);
    state.dragging = true;
    state.dragTarget = hitTarget(point);
    state.pointerStartX = point.x;
    state.pointerStartY = point.y;
    const activeOffset = state.dragTarget === 'photo'
      ? { x: state.offsetX, y: state.offsetY }
      : state.elementOffsets[state.dragTarget];
    state.offsetStartX = activeOffset.x;
    state.offsetStartY = activeOffset.y;
    canvas.classList.add('dragging');
    canvas.classList.remove('element-hover');
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    if (!state.dragging) {
      canvas.classList.toggle('element-hover', hitTarget(point) !== 'photo');
      return;
    }
    const deltaX = point.x - state.pointerStartX;
    const deltaY = point.y - state.pointerStartY;
    if (state.dragTarget === 'photo') {
      state.offsetX = state.offsetStartX + deltaX;
      state.offsetY = state.offsetStartY + deltaY;
      constrainOffsets();
      snapPhotoToCanvas();
    } else {
      const scale = layoutScale();
      state.elementOffsets[state.dragTarget].x = state.offsetStartX + deltaX / scale;
      state.elementOffsets[state.dragTarget].y = state.offsetStartY + deltaY / scale;
    }
    render();
    if (state.dragTarget !== 'photo') {
      const snapped = snapElement(state.dragTarget);
      render();
      if (keepElementInside(state.dragTarget)) render();
      if (!snapped) state.guides = [];
    }
  });

  function stopDragging(event) {
    if (!state.dragging) return;
    state.dragging = false;
    state.guides = [];
    canvas.classList.remove('dragging');
    render();
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
  }

  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);

  canvas.addEventListener('keydown', (event) => {
    if (!state.photo || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 30 : 10;
    const offset = state.dragTarget === 'photo'
      ? { x: state.offsetX, y: state.offsetY }
      : state.elementOffsets[state.dragTarget];
    if (event.key === 'ArrowLeft') offset.x -= step;
    if (event.key === 'ArrowRight') offset.x += step;
    if (event.key === 'ArrowUp') offset.y -= step;
    if (event.key === 'ArrowDown') offset.y += step;
    if (state.dragTarget === 'photo') {
      state.offsetX = offset.x;
      state.offsetY = offset.y;
      constrainOffsets();
    }
    render();
    if (state.dragTarget !== 'photo' && keepElementInside(state.dragTarget)) render();
  });

  $('resetBtn').addEventListener('click', () => {
    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    Object.values(state.elementOffsets).forEach((offset) => {
      offset.x = 0;
      offset.y = 0;
    });
    state.dragTarget = 'photo';
    state.guides = [];
    $('zoom').value = 1;
    $('brightness').value = 100;
    $('contrast').value = 100;
    $('saturation').value = 100;
    updateRanges();
    render();
    showToast('تنظیمات تصویر بازنشانی شد.');
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.photo) return;
    state.guides = [];
    render();
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast('ساخت فایل ناموفق بود.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.photoName}-raf-${outputName()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast('فایل PNG آماده شد.');
    }, 'image/png');
  });

  Promise.all([
    document.fonts.load('600 38px Dana'),
    document.fonts.load('500 20px Dana'),
    fileToImage('assets/images/logo-20260806.png').then((logo) => { state.logo = logo; })
  ]).finally(() => render());

  let previewResizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(previewResizeFrame);
    previewResizeFrame = requestAnimationFrame(fitCanvasShell);
  }).observe(document.querySelector('.canvas-stage'));

  applyFormat();
  updateRanges();
  render();
})();
