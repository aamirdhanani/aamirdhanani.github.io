/* Shared site chrome (nav) for inner pages — theme toggle, mobile menu, auto-hide.
   Page-specific behavior (timeline reveals, travel map, lightbox, fitness) lives
   in each page's own script and is untouched. Progressive enhancement only. */
(function(){
  "use strict";

  /* theme toggle — follows OS by default; an explicit choice is saved to
     localStorage and re-applied on every page (see the inline <head> script)
     so light/dark carries across the whole site. */
  var themeBtn = document.getElementById("theme");
  function effTheme(){
    var t = document.documentElement.getAttribute("data-theme");
    return t || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  }
  function syncIcon(){ if(themeBtn) themeBtn.setAttribute("data-mode", effTheme()); }
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

  /* nav auto-hide on scroll down, reveal on scroll up */
  var lastY = scrollY, ticking = false;
  function onScroll(){
    var y = scrollY;
    if(nav && !nav.classList.contains("open")){
      if(y > lastY && y > 140) nav.classList.add("hidden");
      else if(y < lastY) nav.classList.remove("hidden");
    }
    lastY = y; ticking = false;
  }
  addEventListener("scroll", function(){
    if(!ticking){ ticking = true; requestAnimationFrame(onScroll); }
  }, { passive:true });
})();
