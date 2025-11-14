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
  