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

  /* full-screen menu overlay (the homepage has no sticky nav) */
  var menuBtn = document.getElementById("menuBtn");
  var menuOverlay = document.getElementById("menuOverlay");
  if (menuBtn && menuOverlay) {
    var menuLabel = menuBtn.querySelector(".menu-btn-label");
    var pageParts = [document.querySelector("main"), document.querySelector(".foot")];
    function setInert(on){ pageParts.forEach(function(el){ if(el){ on ? el.setAttribute("inert","") : el.removeAttribute("inert"); } }); }
    function openMenu(){
      document.body.classList.add("menu-open");
      menuBtn.setAttribute("aria-expanded","true");
      if(menuLabel) menuLabel.textContent = "Close";
      setInert(true);
      var first = menuOverlay.querySelector("a");
      if(first) first.focus();
    }
    function closeMenu(){
      document.body.classList.remove("menu-open");
      menuBtn.setAttribute("aria-expanded","false");
      if(menuLabel) menuLabel.textContent = "Menu";
      setInert(false);
      menuBtn.focus();
    }
    menuBtn.addEventListener("click", function(){
      document.body.classList.contains("menu-open") ? closeMenu() : openMenu();
    });
    menuOverlay.addEventListener("click", function(e){
      if(e.target.tagName === "A") closeMenu(); // navigating away — close first
    });
    addEventListener("keydown", function(e){
      if(e.key === "Escape" && document.body.classList.contains("menu-open")) closeMenu();
    });
  }

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
