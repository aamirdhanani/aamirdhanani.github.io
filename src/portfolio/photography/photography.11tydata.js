const fs = require("fs");
const path = require("path");

module.exports = () => {
  const baseDir = path.join(__dirname);

  // Get all subdirectories (categories)
  const categories = fs.readdirSync(baseDir)
    .filter(name => fs.lstatSync(path.join(baseDir, name)).isDirectory())
    .map(name => {
      const folderPath = path.join(baseDir, name);

      // Read the images inside each category
      const images = fs.readdirSync(folderPath)
        .filter(file => /\.(jpg|jpeg|png|webp|avif)$/i.test(file));

      return {
        name,
        encodedName: encodeURIComponent(name),
        images,
        cover: images.includes("cover.jpg") ? "cover.jpg" : images[0],
        url: `/portfolio/photography/${encodeURIComponent(name)}/`
      };
    });

  return {
    categories,
    eleventyComputed: {
      title: (data) => data.category ? `${data.category.name.charAt(0).toUpperCase()}${data.category.name.slice(1)} Photography` : "Photography"
    }
  };
};
