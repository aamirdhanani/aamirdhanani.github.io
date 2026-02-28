module.exports = function (eleventyConfig) {
  // Copy static files (images, CSS)
  eleventyConfig.addPassthroughCopy(".nojekyll");
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("src/portfolio/photography");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });

  // Add date filter
  eleventyConfig.addFilter("dateFilter", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  });


  // Set input and output folders
  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    }
  };
};
