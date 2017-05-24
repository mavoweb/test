# How to run the testsuite with your local version of Mavo

1. Clone this repo locally and start a local server on it (or one of its parents). The important thing is that you don’t load it over `file://`.
2. Start a local server on 8000 **in your local Mavo repo**, i.e. so that `http://localhost:8000/dist/mavo.js` resolves to your local `mavo.js`. An easy way to do this is `python -m SimpleHTTPServer 8000`.
3. That's it! Your local testsuite should now use your local version of Mavo, thanks to the beauty of Service Workers!

Note: Service Workers are only applied after the second pageload, so regardless of what you do, the first time you load any page, it will use the remote version of Mavo.
