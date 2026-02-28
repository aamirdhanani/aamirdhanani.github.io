// Animate timeline items on scroll
document.addEventListener("DOMContentLoaded", () => {
    const items = document.querySelectorAll(".timeline-animate");
  
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target); // trigger once
          }
        });
      },
      { threshold: 0.15 }
    );
  
    items.forEach((item) => observer.observe(item));
  });
  

  document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".filter-btn");
    const cards = document.querySelectorAll(".journal-card");
  
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        // update active button
        document.querySelector(".filter-btn.active")?.classList.remove("active");
        btn.classList.add("active");
  
        const filter = btn.dataset.filter;
  
        cards.forEach(card => {
          const tag = card.querySelector(".journal-tag")?.textContent.trim().toLowerCase();
  
          if (filter === "all" || filter === tag) {
            card.style.display = "block";
          } else {
            card.style.display = "none";
          }
        });
      });
    });
  });
  