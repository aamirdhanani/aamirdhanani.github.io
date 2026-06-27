// Interactive travel map (Leaflet + OpenStreetMap).
// Pins come from window.TRAVEL_PLACES, injected by the travel page.
(function () {
  function initTravelMap() {
    var mapEl = document.getElementById("travelMap");
    var btn = document.getElementById("mapToggle");
    if (!mapEl || !btn || typeof L === "undefined") return;

    var places = (window.TRAVEL_PLACES && window.TRAVEL_PLACES.pins) || [];
    var map = null;

    function buildMap() {
      map = L.map(mapEl, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      var markers = [];
      places.forEach(function (p) {
        if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
        var marker = L.marker([p.lat, p.lng]).addTo(map);
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

    btn.addEventListener("click", function () {
      var isHidden = mapEl.hasAttribute("hidden");
      if (isHidden) {
        mapEl.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "🗺️ Hide map";
        if (!map) buildMap();
        // Leaflet needs the container to be visible to size tiles correctly.
        setTimeout(function () { map.invalidateSize(); }, 0);
      } else {
        mapEl.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "🗺️ View map";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTravelMap);
  } else {
    initTravelMap();
  }
})();
