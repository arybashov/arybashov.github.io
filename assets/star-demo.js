/* Live star demo: embeds the M31 star simulator (same origin: arybashov.github.io/star-sim/)
   without its control panel. Loads only when the block is on screen, sleeps (display:none
   stops the iframe's rendering) when it scrolls away, and takes pointer input only after a
   click so the page scroll is never captured by accident. */
(function () {
  const box = document.getElementById('starDemo');
  if (!box) return;
  const frame = box.querySelector('iframe');
  let loaded = false;
  const PRESET = box.dataset.preset || '1';   // index in the stand's preset list: 1 = Barnard's Star
  const ZOOM = +box.dataset.zoom || -860;      // wheel delta: dist 6.2 -> ~2.2 R, the star fills the card
  // the stand saves its state in localStorage, shared with this origin — keep the owner's own stand settings intact
  const LS = 'm31.starlab.v1';
  let saved = null;
  try { saved = localStorage.getItem(LS); } catch (e) {}
  function restore() { try { saved == null ? localStorage.removeItem(LS) : localStorage.setItem(LS, saved); } catch (e) {} }
  addEventListener('pagehide', restore);

  function setup(tries) {
    try {
      const d = frame.contentDocument, btn = d.querySelector('#presets button[data-i="' + PRESET + '"]'), cv = d.querySelector('#view canvas');
      if (!btn || !cv) return tries > 0 ? setTimeout(() => setup(tries - 1), 300) : box.classList.add('ready');
      btn.click();
      setTimeout(() => {
        cv.dispatchEvent(new d.defaultView.WheelEvent('wheel', { deltaY: ZOOM, bubbles: true, cancelable: true }));
        setTimeout(() => box.classList.add('ready'), 1200);
      }, 1500);
    } catch (e) { box.classList.add('ready'); }
  }

  function strip() {
    try {
      const d = frame.contentDocument;
      if (!d || !d.head) return false;
      if (!d.getElementById('embedStyle')) {
        const s = d.createElement('style');
        s.id = 'embedStyle';
        s.textContent = '#panel,#hud{display:none!important}#view{inset:0!important}html,body{overflow:hidden!important}';
        d.head.appendChild(s);
        d.defaultView.dispatchEvent(new Event('resize'));
      }
      return true;
    } catch (e) { return false; } // different origin (e.g. local preview) — show it as is
  }

  frame.addEventListener('load', () => {
    if (strip()) setup(20); else box.classList.add('ready');
  });

  function load() {
    if (loaded) return;
    loaded = true;
    // on the real site the stand is same-origin; elsewhere (a copy, a preview without ./star-sim) use the published stand
    let src = box.dataset.src;
    if (location.hostname !== 'arybashov.github.io' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') src = 'https://arybashov.github.io' + src;
    frame.src = src;
  }

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { load(); frame.style.display = ''; }
    else if (loaded) { frame.style.display = 'none'; box.classList.remove('active'); restore(); }
  }), { rootMargin: '200px 0px' });
  io.observe(box);

  box.addEventListener('click', () => { if (box.classList.contains('ready')) box.classList.add('active'); });
  // leaving the card hands control back to the page
  box.addEventListener('pointerleave', () => box.classList.remove('active'));
})();
