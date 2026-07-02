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

    info.innerHTML = `<strong>${formattedDate}</strong>: ${count} activity${count == 1 ? '' : 'ies'}`;
  });
});
