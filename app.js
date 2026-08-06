(() => {
  'use strict';

  const formats = {
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
    format: 'post'
  };

  const number = (id) => Number($(id).value) || 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const persianNumber = (value) => new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);
  const dimensions = () => formats[state.format];
  const outputName = () => `${dimensions().width}x${dimensions().height}`;

  function applyFormat() {
    const { width, height, label } = dimensions();
    canvas.width = width;
    canvas.height = height;
    $('canvasShell').style.setProperty('--canvas-ratio', `${width} / ${height}`);
    $('canvasMeta').textContent = `${persianNumber(width)} × ${persianNumber(height)}`;
    document.querySelector('.step-badge').textContent = state.format === 'square' ? '۱:۱' : state.format === 'post' ? '۴:۵' : '۹:۱۶';
    $('downloadBtn').setAttribute('aria-label', `دانلود PNG ${label}`);
    constrainOffsets();
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
    const maxX = Math.max(0, (geometry.width - W) / 2);
    const maxY = Math.max(0, (geometry.height - H) / 2);
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
    const inset = number('borderInset');
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${clamp(number('borderOpacity') / 100, 0, 1)})`;
    ctx.lineWidth = Math.max(1, number('borderWidth'));
    const { width: W, height: H } = dimensions();
    roundedRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, number('borderRadius'));
    ctx.stroke();
    ctx.restore();
  }

  function drawLogo() {
    if (!state.logo) return;
    const { width: W } = dimensions();
    const width = number('logoWidth');
    const height = width * state.logo.height / state.logo.width;
    ctx.save();
    ctx.globalAlpha = clamp(number('logoOpacity') / 100, 0, 1);
    ctx.drawImage(state.logo, W * 0.065, W * 0.063, width, height);
    ctx.restore();
  }

  function setTextShadow() {
    if (!$('textShadow').checked) return;
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
  }

  function drawText() {
    const { width: W, height: H } = dimensions();
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
      ctx.font = '500 22px Dana, Arial, sans-serif';
      ctx.fillText(handle, W * 0.067, W * 0.17);
      ctx.restore();
    }

    if (faTitle) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.direction = 'rtl';
      ctx.font = `600 ${number('faTitleSize')}px Dana, Tahoma, sans-serif`;
      setTextShadow();
      ctx.fillText(faTitle, W - 83, H - 128);
      ctx.restore();
    }

    if (enTitle) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.direction = 'ltr';
      ctx.font = `400 ${number('enTitleSize')}px Dana, Arial, sans-serif`;
      setTextShadow();
      ctx.fillText(enTitle, W - 83, H - 83);
      ctx.restore();
    }
  }

  function updateStatus() {
    if (!state.photo) {
      setStatus('آماده‌ی شروع', 'عکس‌ها فقط در مرورگر شما پردازش می‌شوند.');
      return;
    }
    const warnings = [];
    ctx.save();
    ctx.font = `600 ${number('faTitleSize')}px Dana, Tahoma, sans-serif`;
    if (ctx.measureText($('faTitle').value.trim()).width > 430) warnings.push('عنوان فارسی بلند است.');
    ctx.font = `400 ${number('enTitleSize')}px Dana, Arial, sans-serif`;
    if (ctx.measureText($('enTitle').value.trim()).width > 360) warnings.push('عنوان انگلیسی بلند است.');
    ctx.restore();
    if (warnings.length) setStatus('نیاز به بررسی', warnings.join(' '), true);
    else setStatus('خروجی آماده است', 'برای دریافت تصویر باکیفیت، روی «دانلود PNG» بزن.');
  }

  function render() {
    const { width: W, height: H } = dimensions();
    ctx.clearRect(0, 0, W, H);
    drawPhoto();
    if (state.photo) {
      drawFrame();
      drawLogo();
      drawText();
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
    state.pointerStartX = point.x;
    state.pointerStartY = point.y;
    state.offsetStartX = state.offsetX;
    state.offsetStartY = state.offsetY;
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const point = canvasPoint(event);
    state.offsetX = state.offsetStartX + point.x - state.pointerStartX;
    state.offsetY = state.offsetStartY + point.y - state.pointerStartY;
    constrainOffsets();
    render();
  });

  function stopDragging(event) {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove('dragging');
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
  }

  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);

  $('resetBtn').addEventListener('click', () => {
    state.zoom = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    $('zoom').value = 1;
    $('brightness').value = 103;
    $('contrast').value = 104;
    $('saturation').value = 99;
    updateRanges();
    render();
    showToast('تنظیمات تصویر بازنشانی شد.');
  });

  $('downloadBtn').addEventListener('click', () => {
    if (!state.photo) return;
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
    fileToImage('assets/images/logo.png').then((logo) => { state.logo = logo; })
  ]).finally(() => render());

  applyFormat();
  updateRanges();
  render();
})();
