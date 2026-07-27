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
    // The pill sits in the masthead at the top; once you scroll past it (or while
    // the menu is open) it detaches and floats fixed to the top-right, animating in.
    function updateFloat(){
      menuBtn.classList.toggle("floating", document.body.classList.contains("menu-open") || scrollY > 64);
    }
    function openMenu(){
      document.body.classList.add("menu-open");
      menuBtn.setAttribute("aria-expanded","true");
      if(menuLabel) menuLabel.textContent = "Close";
      updateFloat();
      setInert(true);
      requestAnimationFrame(function(){ var first = menuOverlay.querySelector("a"); if(first) first.focus(); });
    }
    function closeMenu(){
      document.body.classList.remove("menu-open");
      menuBtn.setAttribute("aria-expanded","false");
      if(menuLabel) menuLabel.textContent = "Menu";
      setInert(false);
      updateFloat();
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
    addEventListener("scroll", updateFloat, {passive:true});
    updateFloat();
  }

  /* theme toggle — follows the OS setting by default; an explicit choice is
     saved to localStorage and applied on every page (see the inline <head>
     script in home.njk/layout.njk) so it carries across the whole site. */
  var themeBtn = document.getElementById("theme");
  function effTheme(){
    var t = document.documentElement.getAttribute("data-theme");
    return t || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  }
  function syncIcon(){
    if(!themeBtn) return;
    var m = effTheme();
    themeBtn.setAttribute("data-mode", m);
    var lbl = themeBtn.querySelector(".theme-label");
    if(lbl) lbl.textContent = m === "dark" ? "Light mode" : "Dark mode";
  }
  if(themeBtn){
    themeBtn.addEventListener("click", function(){
      var next = effTheme()==="dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try{ localStorage.setItem("theme", next); }catch(e){}
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
