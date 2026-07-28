document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('heatmapGrid');
  const info = document.getElementById('heatmapInfo');

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.heatmap-cell');
    if (!cell) return;

    // Clear previous selection
    document.querySelectorAll('.heatmap-cell').forEach(c => c.classList.remove('is-selected'));

    // Mark as selected
    cell.classList.add('is-selected');

    // Update data details
    const date = cell.getAttribute('data-date');
    const count = cell.getAttribute('data-count');

    // Format date nicely
    const d = new Date(date);
    const formattedDate = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    info.innerHTML = `<strong>${formattedDate}</strong>: ${count} ${count == 1 ? 'activity' : 'activities'}`;
  });
});

/* Route-draw animation: trace each GPS track from the run's start to its finish
   when the card enters the viewport. The dash length is measured per path
   (getTotalLength) and set in real user units, so once revealed (offset 0) it
   always covers the whole route — a normalized pathLength dash was dropping
   segments on some paths under non-scaling-stroke. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = [].slice.call(document.querySelectorAll('.route-card'))
    .filter((c) => c.querySelector('.route-line'));
  if (!cards.length) return;

  // Arm each route: park the full-length dash just before the start point.
  cards.forEach((card) => {
    const line = card.querySelector('.route-line');
    let len = 0;
    try { len = line.getTotalLength(); } catch (e) { /* no geometry */ }
    if (!len) { card.dataset.noDraw = '1'; return; }
    if (reduce) return; // leave the line solid; dots shown via reduced-motion CSS
    line.style.transition = 'none';                       // don't animate the arming
    line.style.strokeDasharray = `${len} ${len + 1}`;     // non-repeating over the path
    line.style.strokeDashoffset = -len;                   // hidden, parked before the start
    line.getBoundingClientRect();                         // commit before enabling transition
    line.style.transition = '';
  });

  if (reduce || !('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('is-drawn'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const card = en.target;
      const line = card.querySelector('.route-line');
      if (line && !card.dataset.noDraw) line.style.strokeDashoffset = '0'; // trace start -> finish
      card.classList.add('is-drawn');
      io.unobserve(card);
    });
  }, { threshold: 0.3 });
  cards.forEach((c) => io.observe(c));
})();
