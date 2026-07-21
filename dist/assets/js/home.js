/* =====================================================================
   Aamir Dhanani — Home (v2 "Aperture")
   Scoped script for the redesigned homepage ONLY (named home.js so it
   never collides with the v1 main.js used by the inner pages).
   All motion is progressive enhancement: if this file fails to run,
   every element is already visible (see the .js gating in home.css).
   ===================================================================== */
(function(){
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* theme toggle — follows the OS setting by default; this only overrides for the session */
  var themeBtn = document.getElementById("theme");
  function effTheme(){
    var t = document.documentElement.getAttribute("data-theme");
    return t || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  }
  function syncIcon(){ if(themeBtn) themeBtn.setAttribute("data-mode", effTheme()); }
  if(themeBtn){
    themeBtn.addEventListener("click", function(){
      document.documentElement.setAttribute("data-theme", effTheme()==="dark" ? "light" : "dark");
      syncIcon();
    });
    syncIcon();
    matchMedia("(prefers-color-scheme:dark)").addEventListener("change", syncIcon);
  }

  /* mobile menu */
  var nav = document.getElementById("nav"),
      burger = document.getElementById("burger"),
      navlinks = document.getElementById("navlinks");
  if(burger) burger.addEventListener("click", function(){ nav.classList.toggle("open"); });
  if(navlinks) navlinks.addEventListener("click", function(e){
    if(e.target.tagName === "A") nav.classList.remove("open");
  });

  /* scroll reveals */
  var revs = [].slice.call(document.querySelectorAll(".rev:not(.in)"));
  if(reduce || !("IntersectionObserver" in window)){
    revs.forEach(function(e){ e.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function(ents){
      ents.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold:.18, rootMargin:"0px 0px -8% 0px" });
    revs.forEach(function(e){ io.observe(e); });
  }

  /* scrollspy nav underline + nav auto-hide on scroll down */
  var secIds = ["about","photo","hobbies","work","contact"];
  var secs = secIds.map(function(id){ return document.getElementById(id); }).filter(Boolean);
  var links = [].slice.call(document.querySelectorAll('#navlinks a[href^="#"]'));
  function spy(){
    var pos = scrollY + 120, cur = secs[0] ? secs[0].id : "";
    secs.forEach(function(s){ if(s.offsetTop <= pos) cur = s.id; });
    links.forEach(function(a){
      a.classList.toggle("active", a.getAttribute("href").slice(1) === cur);
    });
  }
  var lastY = scrollY, ticking = false;
  function onScroll(){
    var y = scrollY;
    if(nav && !nav.classList.contains("open")){
      if(y > lastY && y > 140) nav.classList.add("hidden");
      else if(y < lastY) nav.classList.remove("hidden");
    }
    lastY = y; spy(); ticking = false;
  }
  addEventListener("scroll", function(){
    if(!ticking){ ticking = true; requestAnimationFrame(onScroll); }
  }, { passive:true });
  spy();
})();
