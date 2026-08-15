// Karma configuration for browser test coverage.

module.exports = function (config) {
    config.set({
        basePath: "..",
        frameworks: ["jasmine"],
        files: [
            "distrib/jsxgraphsrc.js",
            { pattern: "test/test*.js", watched: true },
            { pattern: "tmp/test-contracts/*.test.js", watched: true }
        ],
        preprocessors: {
            "distrib/jsxgraphsrc.js": ["coverage"]
        },
        reporters: ["progress", "coverage"],
        coverageReporter: {
            dir: "coverage",
            reporters: [
                { type: "text-summary" },
                { type: "html", subdir: "html" },
                { type: "lcovonly", subdir: ".", file: "lcov.info" }
            ],
            check: {
                global: {
                    statements: 40,
                    branches: 33,
                    functions: 40,
                    lines: 40
                }
            }
        },
        browsers: ["ChromeHeadless"],
        singleRun: true,
        concurrency: Infinity
    });
};
