/* Shared site chrome for inner pages — the Aperture masthead + full-screen menu
   overlay (same language as the homepage) and the theme toggle. Page-specific
   behavior (timeline reveals, travel map, lightbox, fitness) lives in each
   page's own script and is untouched. Progressive enhancement only. */
(function(){
  "use strict";

  /* theme toggle — lives in the menu foot; follows the OS by default, and an
     explicit choice persists via localStorage (re-applied by the inline <head>
     script on every page) so light/dark carries across the whole site. */
  var themeBtn = document.getElementById("theme");
  function effTheme(){
    var t = document.documentElement.getAttribute("data-theme");
    return t || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  }
  function syncTheme(){
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
      syncTheme();
    });
    syncTheme();
    matchMedia("(prefers-color-scheme:dark)").addEventListener("change", syncTheme);
  }

  /* full-screen menu overlay — the masthead pill opens it; on scroll (or while
     open) the pill detaches and floats to the top-right. */
  var menuBtn = document.getElementById("menuBtn");
  var menuOverlay = document.getElementById("menuOverlay");
  if(menuBtn && menuOverlay){
    var menuLabel = menuBtn.querySelector(".menu-btn-label");
    var pageParts = [document.querySelector("main"), document.querySelector(".foot")];
    function setInert(on){ pageParts.forEach(function(el){ if(el){ on ? el.setAttribute("inert","") : el.removeAttribute("inert"); } }); }
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
})();
