// Simple in-page lightbox for photo grids using [data-lightbox="gallery"] anchors
document.addEventListener("DOMContentLoaded", () => {
  const items = Array.from(document.querySelectorAll('[data-lightbox="gallery"]'));
  if (!items.length) return;

  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <button class="lightbox-prev" aria-label="Previous photo">&larr;</button>
    <img class="lightbox-img" alt="">
    <button class="lightbox-next" aria-label="Next photo">&rarr;</button>
  `;
  document.body.appendChild(overlay);

  const img = overlay.querySelector(".lightbox-img");
  let currentIndex = 0;

  const show = (index) => {
    currentIndex = (index + items.length) % items.length;
    const anchor = items[currentIndex];
    img.src = anchor.getAttribute("href");
    img.alt = anchor.querySelector("img")?.alt || "";
    overlay.classList.add("open");
    document.body.classList.add("lightbox-active");
  };

  const close = () => {
    overlay.classList.remove("open");
    document.body.classList.remove("lightbox-active");
  };

  items.forEach((anchor, index) => {
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      show(index);
    });
  });

  overlay.querySelector(".lightbox-close").addEventListener("click", close);
  overlay.querySelector(".lightbox-prev").addEventListener("click", () => show(currentIndex - 1));
  overlay.querySelector(".lightbox-next").addEventListener("click", () => show(currentIndex + 1));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(currentIndex - 1);
    if (e.key === "ArrowRight") show(currentIndex + 1);
  });
});
