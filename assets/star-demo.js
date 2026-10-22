/* Star demo.
   Powerful GPU (desktop NVIDIA / AMD RX·Pro / Apple M-Pro·Max·Ultra, same rule as the stand itself):
   the live M31 star simulator (same origin: /star-sim/) without its panel, fixed "high" quality so
   the stand's auto-quality cannot drop to emergency resolution after the tab or block was hidden.
   Everything else: crossfading frames of different stars rendered by the simulator, with a note
   about the GPU and a "run anyway" button. */
(function () {
  const box = document.getElementById('starDemo');
  if (!box) return;
  const frame = box.querySelector('iframe');
  const slides = [...box.querySelectorAll('.sd-slides img')];
  const $ = id => document.getElementById(id);
  const tag = $('sdTag'), hint = $('sdHint'), cap = $('sdCap'), gpu = $('sdGpu'), run = $('sdRun'), open = $('sdOpen'), load = $('sdLoad');

  const T = {
    ru: {
      stars: [
        ['Звезда Барнарда · M4V', 'Звезда Барнарда — красный карлик в 6 световых годах: корона в ультрафиолете, магнитное поле, нагрев и вспышки.'],
        ['Корона крупно · Проксима', 'Арки короны над краем Проксимы: горячая плазма течёт вдоль петель магнитного поля между пятнами разной полярности.'],
        ['Корональный выброс · Солнце', 'Корональный выброс массы: магнитная петля над активной областью теряет равновесие и уносит плазму от звезды.'],
        ['Проксима Центавра · M5.5Ve', 'Проксима Центавра — ближайшая к нам звезда, 4,2 светового года: вспыхивающий красный карлик с яркими петлями поля.'],
        ['Солнце · G2V', 'Солнце — эталон модели: корона сверена со снимками SDO/AIA 171, видна магнитная сетка спокойной поверхности.'],
        ['ε Индейца · K5V', 'ε Индейца — оранжевый карлик в 12 световых годах: спокойная корона и редкие активные области.']],
      liveTag: 'Live · звезда Барнарда',
      liveCap: 'Живая симуляция звезды Барнарда — красного карлика в 6 световых годах: корона в ультрафиолете, магнитное поле, нагрев и вспышки. Считается прямо сейчас на вашей видеокарте.',
      rotate: 'Нажмите, чтобы вращать', load: 'Зажигаем звезду…',
      gpuWeak: 'Кадры из моего симулятора звёзд для игры «Горизонт М31». Живая версия считает объёмную корону на видеокарте (WebGL2) и запускается здесь только на мощном GPU.',
      gpuLive: 'Симулятор звёзд для игры «Горизонт М31»: объёмный рендер короны на видеокарте (WebGL2).',
      runAnyway: 'Запустить всё равно', open: 'Открыть стенд →'
    },
    en: {
      stars: [
        ['Barnard’s Star · M4V', 'Barnard’s Star, a red dwarf 6 light-years away: ultraviolet corona, magnetic field, heating and flares.'],
        ['Corona close-up · Proxima', 'Coronal arcades over Proxima’s limb: hot plasma flows along magnetic loops between spots of opposite polarity.'],
        ['Coronal mass ejection · Sun', 'A coronal mass ejection: a magnetic loop above an active region loses equilibrium and carries plasma away from the star.'],
        ['Proxima Centauri · M5.5Ve', 'Proxima Centauri, our nearest star at 4.2 light-years: a flaring red dwarf with bright field loops.'],
        ['The Sun · G2V', 'The Sun is the reference: the corona is calibrated against SDO/AIA 171 images, with the magnetic network of the quiet surface.'],
        ['ε Indi · K5V', 'ε Indi, an orange dwarf 12 light-years away: a quiet corona and rare active regions.']],
      liveTag: 'Live · Barnard’s Star',
      liveCap: 'Live simulation of Barnard’s Star, a red dwarf 6 light-years away: ultraviolet corona, magnetic field, heating and flares. Rendered right now on your GPU.',
      rotate: 'Click to rotate', load: 'Igniting the star…',
      gpuWeak: 'Frames from my star simulator for the game “Horizon M31”. The live version renders a volumetric corona on the GPU (WebGL2) and runs here only on a powerful graphics card.',
      gpuLive: 'Star simulator for the game “Horizon M31”: volumetric corona rendered on the GPU (WebGL2).',
      runAnyway: 'Run it anyway', open: 'Open the bench →'
    }
  };
  const L = () => T[document.documentElement.lang === 'en' ? 'en' : 'ru'];

  // ---- GPU check (mirrors the stand's own "high" guess)
  function strongGpu() {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return false;
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) return false;
      const x = gl.getExtension('WEBGL_debug_renderer_info');
      const r = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return /NVIDIA|GeForce|Quadro|RTX|Radeon (RX|Pro)|Apple M\d+ (Pro|Max|Ultra)/i.test(r);
    } catch (e) { return false; }
  }
  const strong = !new URLSearchParams(location.search).has('slides') && strongGpu();   // ?slides — force the frames mode (to preview what weaker devices see)
  let live = false, forceHigh = false, idx = 0, timer = 0;

  // ---- slideshow
  function show(i) {
    slides.forEach((im, k) => im.classList.toggle('on', k === i));
    const s = L().stars[i];
    tag.textContent = s[0];
    cap.classList.add('fade');
    setTimeout(() => { if (!live) cap.textContent = s[1]; cap.classList.remove('fade'); }, 350);
    hint.innerHTML = '<span class="sd-dots">' + slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('') + '</span>';
  }
  function play() { clearInterval(timer); timer = setInterval(() => { idx = (idx + 1) % slides.length; show(idx); }, 6000); }

  function texts() {
    const l = L();
    load.textContent = l.load;
    open.textContent = l.open;
    run.textContent = l.runAnyway;
    run.hidden = live;
    gpu.textContent = live ? l.gpuLive : l.gpuWeak;
    if (live) { tag.textContent = l.liveTag; cap.textContent = l.liveCap; hint.textContent = l.rotate; }
    else show(idx);
  }

  // ---- live simulator
  const LS = 'm31.starlab.v1';            // the stand's saved state (shared origin) — keep the owner's settings
  let saved = null, loaded = false;
  try { saved = localStorage.getItem(LS); } catch (e) {}
  function restore() { try { saved == null ? localStorage.removeItem(LS) : localStorage.setItem(LS, saved); } catch (e) {} }
  addEventListener('pagehide', restore);

  function strip() {
    try {
      const d = frame.contentDocument;
      if (!d || !d.head) return false;
      if (!d.getElementById('embedStyle')) {
        const s = d.createElement('style'); s.id = 'embedStyle';
        s.textContent = '#panel,#hud{display:none!important}#view{inset:0!important}html,body{overflow:hidden!important}';
        d.head.appendChild(s); d.defaultView.dispatchEvent(new Event('resize'));
      }
      return true;
    } catch (e) { return false; }
  }
  function setup(tries) {
    try {
      const d = frame.contentDocument, btn = d.querySelector('#presets button[data-i="' + (box.dataset.preset || '1') + '"]'), cv = d.querySelector('#view canvas'), q = d.getElementById('quality');
      if (!btn || !cv) return tries > 0 ? setTimeout(() => setup(tries - 1), 300) : box.classList.add('ready');
      if (forceHigh && q && q.value !== 'high') { q.value = 'high'; q.dispatchEvent(new Event('change', { bubbles: true })); }
      btn.click();
      setTimeout(() => {
        cv.dispatchEvent(new d.defaultView.WheelEvent('wheel', { deltaY: +box.dataset.zoom || -860, bubbles: true, cancelable: true }));
        setTimeout(() => box.classList.add('ready'), 1200);
      }, 1500);
    } catch (e) { box.classList.add('ready'); }
  }
  frame.addEventListener('load', () => { if (strip()) setup(20); else box.classList.add('ready'); });

  function startLive(high) {
    if (live) return;
    live = true; forceHigh = high;
    clearInterval(timer);
    box.classList.add('live');
    texts();
    if (!loaded) {
      loaded = true;
      let src = box.dataset.src;
      if (!/^(arybashov\.github\.io|localhost|127\.0\.0\.1)$/.test(location.hostname)) src = 'https://arybashov.github.io' + src;
      frame.src = src;
    }
  }

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      if (live) frame.style.display = '';
      else if (strong) startLive(true);
      else play();
    } else {
      if (live) { frame.style.display = 'none'; box.classList.remove('active'); restore(); }
      else clearInterval(timer);
    }
  }), { rootMargin: '200px 0px' });
  io.observe(box);

  run.addEventListener('click', () => startLive(false));
  box.addEventListener('click', () => { if (live && box.classList.contains('ready')) box.classList.add('active'); });
  box.addEventListener('pointerleave', () => box.classList.remove('active'));

  // re-render texts when the page language changes
  new MutationObserver(texts).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  texts();
})();
