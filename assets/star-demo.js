/* Live star demo: embeds the M31 star simulator (same origin: arybashov.github.io/star-sim/)
   without its control panel. Loads only when the block is on screen, sleeps (display:none
   stops the iframe's rendering) when it scrolls away, and takes pointer input only after a
   click so the page scroll is never captured by accident. */
(function () {
  const box = document.getElementById('starDemo');
  if (!box) return;
  const frame = box.querySelector('iframe');
  let loaded = false;

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
    strip();
    setTimeout(() => box.classList.add('ready'), 900); // give the first frames time to draw
  });

  function load() {
    if (loaded) return;
    loaded = true;
    frame.src = box.dataset.src;
  }

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { load(); frame.style.display = ''; }
    else if (loaded) { frame.style.display = 'none'; box.classList.remove('active'); }
  }), { rootMargin: '200px 0px' });
  io.observe(box);

  box.addEventListener('click', () => { if (box.classList.contains('ready')) box.classList.add('active'); });
  // leaving the card hands control back to the page
  box.addEventListener('pointerleave', () => box.classList.remove('active'));
})();
