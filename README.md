# How to run the testsuite with your local version of Mavo

1. Start a local server **in your local Mavo repo**, e.g. so that `http://localhost:8000/dist/mavo.js` resolves to your local `mavo.js`. An easy way to do this is `python -m SimpleHTTPServer 8000`.
2. Use [Requestly](https://www.requestly.in/) to rewrite `https://get.mavo.io/mavo.js` and `https://get.mavo.io/mavo.css` to your local URLs. You may want to also rewrite the minified & transpiled versions.

This will also allow you to browse *other* Mavos and have them run your local version of Mavo to make sure nothing breaks, since no testsuite ever offers 100% coverage.

For documentation on how to define tests and what syntax is supported, head to [htest.dev](https://htest.dev/).
