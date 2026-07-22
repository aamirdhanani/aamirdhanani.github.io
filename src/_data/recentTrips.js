// Flattens the travel timeline into the N most-recent trips, for the compact
// homepage "On the road" section. Keeps the homepage in sync with travel.json.
const travel = require("./travel.json");

module.exports = () => {
  const flat = [];
  for (const yearBlock of travel.timeline) {
    for (const item of yearBlock.items) {
      flat.push({
        year: yearBlock.year,
        month: item.month,
        location: item.location,
      });
    }
  }
  return flat.slice(0, 5);
};
