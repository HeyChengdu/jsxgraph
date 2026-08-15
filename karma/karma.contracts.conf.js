// Karma configuration for TypeScript public API runtime contracts.

module.exports = function (config) {
    config.set({
        basePath: "..",
        frameworks: ["jasmine"],
        files: ["distrib/jsxgraphsrc.js", "tmp/test-contracts/*.test.js"],
        reporters: ["progress"],
        browsers: ["ChromeHeadless"],
        singleRun: true,
        concurrency: Infinity
    });
};
