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

/* Route-draw animation: trace each GPS track when its card enters the viewport.
   The CSS handles the sweep; this just adds .is-drawn at the right moment. */
(function () {
  const cards = [].slice.call(document.querySelectorAll('.route-card'))
    .filter((c) => c.querySelector('.route-line'));
  if (!cards.length) return;

  if (!('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('is-drawn'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-drawn');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.3 });
  cards.forEach((c) => io.observe(c));
})();
