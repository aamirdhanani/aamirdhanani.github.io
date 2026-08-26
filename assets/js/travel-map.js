// Interactive travel map (Leaflet + OpenStreetMap).
// Pins come from window.TRAVEL_PLACES, injected by the travel page. The map is
// shown by default; the button toggles it. Markers are themed divIcons (styled
// in site.css via CSS variables) so they follow the site's light/dark theme.
(function () {
  function themedIcon() {
    return L.divIcon({
      className: "travel-pin",
      html: '<svg viewBox="0 0 24 32" width="26" height="34" aria-hidden="true">' +
              '<path class="tp-body" d="M12 0C5.9 0 1 4.9 1 11c0 7.7 11 21 11 21s11-13.3 11-21C23 4.9 18.1 0 12 0Z"/>' +
              '<circle class="tp-hole" cx="12" cy="11" r="4.2"/>' +
            '</svg>',
      iconSize: [26, 34],
      iconAnchor: [13, 33],
      popupAnchor: [0, -30]
    });
  }

  function initTravelMap() {
    var mapEl = document.getElementById("travelMap");
    var btn = document.getElementById("mapToggle");
    if (!mapEl || typeof L === "undefined") return;

    var places = (window.TRAVEL_PLACES && window.TRAVEL_PLACES.pins) || [];
    var map = null;

    function buildMap() {
      map = L.map(mapEl, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      var icon = themedIcon();
      var markers = [];
      places.forEach(function (p) {
        if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
        var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
        var html = "<strong>" + p.name + "</strong>";
        if (p.note) html += "<br>" + p.note;
        marker.bindPopup(html);
        markers.push(marker);
      });

      if (markers.length) {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
      } else {
        map.setView([30, 0], 2);
      }
    }

    // Open by default.
    buildMap();
    setTimeout(function () { map.invalidateSize(); }, 0);

    // Button still toggles the map (now default-open).
    if (btn) {
      var label = btn.querySelector(".mt-label");
      function setLabel(text) { if (label) label.textContent = text; }
      btn.addEventListener("click", function () {
        var isHidden = mapEl.hasAttribute("hidden");
        if (isHidden) {
          mapEl.removeAttribute("hidden");
          btn.setAttribute("aria-expanded", "true");
          setLabel("Hide map");
          setTimeout(function () { map.invalidateSize(); }, 0);
        } else {
          mapEl.setAttribute("hidden", "");
          btn.setAttribute("aria-expanded", "false");
          setLabel("View map");
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTravelMap);
  } else {
    initTravelMap();
  }
})();
