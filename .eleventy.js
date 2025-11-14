module.exports = function(eleventyConfig) {
    // Copy static files (images, CSS)
    eleventyConfig.addPassthroughCopy("src/portfolio/photography");
    eleventyConfig.addPassthroughCopy("src/assets");
    eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });

  
    // Set input and output folders
    return {
      dir: {
        input: "src",
        includes: "_includes",
        output: "_site"
      }
    };
  };
