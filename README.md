# How to run the testsuite with your local version of Mavo

1. Start a local server **in your local Mavo repo**, e.g. so that `http://localhost:8000/dist/mavo.js` resolves to your local `mavo.js`. An easy way to do this is `python -m SimpleHTTPServer 8000`.
2. Use [Requestly](https://www.requestly.in/) to rewrite `https://get.mavo.io/mavo.js` and `https://get.mavo.io/mavo.css` to your local URLs. You may want to also rewrite the minified & transpiled versions.

This will also allow you to browse *other* Mavos and have them run your local version of Mavo to make sure nothing breaks, since no testsuite ever offers 100% coverage.

# Creating new tests

Our primary test format is reftests, i.e. automatic comparison of two things, typically app output with expected (reference) output. When the two match, the test passes (green), otherwise it fails (red).

You can create your own reftests with our test framework, by using a table with `class="reftest"`. Each row is a new test. Typically these tables have two columns: output and expected. However, if your test requires initialization data, you can also have 3 columns, and the first one will be ignored in the matching.

Typically these tables are inside sections with HTML like the following:

```html
<section>
	<h1>Heading</h1>
	<table class="reftest">
		<!-- ...tests as <tr>s -->
	</table>
</section>
```

This structure is not necessary for the reftests to work, but it allows you to isolate specific sections, which is often convenient when debugging.

Below is a short description of the syntax we support.

## `data-test` attribute

This applies to either the whole table or individual tests and controls how the matching is done. By default the contents of the cells are compared which corresponds to `data-test="contents"`. Another useful value is `"selector"` which treats the reference cell as a selector (or list of a selectors, if using a `<ul>`) that the output HTML must match. You can reverse the matching with `class="not"`.

Besides the built-in comparison functions, you can provide your own, by defining a JavaScript function, either as the content of the `data-test` attribute, or by defining a global function. It accepts the 2-3 cells of your test as arguments and should return a truthy value for pass and a falsy value for fail.


## `data-click` attribute

Automatic clicking on elements. It can be placed on either the whole table or individual tests. Its location specifies the root for the selector, if one is specified. Its syntax is (angle brackets indicate a parameter, square brackets mean that something is optional):

```
[<selector>] [wait <delay>s] [after <event name>] [<times> times]
```

The parameters can be specified in any order.

Examples:

- `data-click=""`: Clicks the element it's specified on immediately on DOMContentLoaded
- `data-click=".foo"`: Clicks `.foo` elements immediately on DOMContentLoaded
- `data-click=".foo .bar wait 5s after mv-load"`: Clicks `.foo .bar` elements 5 seconds after the `mv-load` event fires
- `data-click=".foo 3 times after hashchange"`: Clicks `.foo` elements 3 times after the `hashchange` event
- `data-click="wait 1s after load"`: Clicks the element it's specified on 1 second after the `load` event fires.
- `data-click="wait 1s after load 2 times"`: Same as above, but clicks twice.

## `data-error` attribute

Use on tests that *should* produce an error to pass.
In future versions of the test harness the value will allow you to specify a specific error class (e.g. `TypeError`).

## `print()` and `println()` functions

Sometimes what is tested is actual JS output. In that case, use `<script>` tags and the `print()` or `println()` functions.
Their only difference is that `prinln()` also prints a line break.
