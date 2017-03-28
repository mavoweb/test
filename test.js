self.print = function print(text) {
	if (document.readyState == "loading") {
		document.write(text);
	}
	else if (document.currentScript && document.currentScript.parentNode) {
		document.currentScript.parentNode.appendChild(document.createTextNode(text));
	}
	else {
		console.log("Test print", text);
	}
};

self.Test = {
	pseudo: (element, pseudo) => {
		var content = getComputedStyle(element, ":" + pseudo).content;
		return content.replace(/^"|"$/g, "");
	},

	content: function(node) {
		var ret = "";

		if (node.nodeType == 1) {
			ret += Test.pseudo(node, "before");
			var special = false;

			for (let selector of Test.contentIgnore) {
				if (node.matches(selector)) {
					return "";
				}
			}

			for (let selector in Test.contentSpecial) {
				if (node.matches(selector)) {
					ret += Test.contentSpecial[selector](node);
					special = true;
					break;
				}
			}

			if (!special) {
				for (let child of node.childNodes) {
					ret += Test.content(child);
				}
			}

			ret += Test.pseudo(node, "after");
		}
		else if (node.nodeType == 3) {
			ret += node.textContent;
		}

		return ret.replace(/\s+/g, " ");
	},

	contentSpecial: {
		"input, textarea": e => e.value
	},

	contentIgnore: [".mv-ui"]
};

var _ = self.RefTest = $.Class({
	constructor: function(table) {
		this.table = table;
		this.compare = self[table.getAttribute("data-test")] || _.defaultCompare;
		this.setup();
		this.test();
	},

	setup: function() {
		// Remove any <script> elements to prevent them messing up the contents. They've already been processed anyway.
		// Keep them in an attribute though, as they may be useful to display
		for (var script of $$("script", this.table)) {
			var attr = script.parentNode.getAttribute("data-script") || "";

			var code = _.presentCode(script.textContent);

			script.parentNode.setAttribute("data-script", attr + code);
			$.remove(script);
		}

		// Add table header if not present
		var cells = [...this.table.rows[0].cells];

		if (!$("thead", this.table) && cells.length > 1) {
			cells = cells.map(td => {
				return {tag: "th"};
			});

			cells[cells.length - 2].textContent = "Actual";
			cells[cells.length - 1].textContent = "Expected";

			$.create("thead", {
				contents: [
					{
						tag: "tr",
						contents:  cells
					}
				],
				start: this.table
			});
		}

		var test = () => {
			requestAnimationFrame(() => this.test());
		};
		this.observer = new MutationObserver(test);
		this.observer.observe(this.table, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
			attributeFilter: ["mv-mode"]
		});

		$.events(this.table, "input change mavo:datachange", test);
		$.events(this.table.closest("[mv-app]"), "mavo:load", test);
	},

	test: function() {
		for (let tr of this.table.tBodies[0].rows) {
			this.testRow(tr);
		}
	},

	testRow: function(tr) {
		var cells = tr.cells;

		if (!tr.compare) {
			var customTest = tr.getAttribute("data-test");
			var compare = self[customTest];

			if (customTest && !compare) {
				// No such function exists, maybe it's code?
				compare = new Function("td", "ref", customTest);
			}

			tr.compare = compare || this.compare;
		}

		if (cells.length) {

			tr.classList.remove("pass", "fail");
			tr.classList.add(tr.compare(...cells)? "pass" : "fail");
		}
	},

	static: {
		defaultCompare: (...cells) => {
			var td = cells[cells.length - 2] || cells[cells.length - 1];
			var ref = cells[cells.length - 1];

			var pass = Test.content(td).trim() == Test.content(ref).trim();

			if (pass) {
				let child = td.firstElementChild;
				let refChild = ref.firstElementChild;

				if (child && child == td.lastElementChild && refChild) {
					if (child.matches("input")) {
						// Compare values
						pass = pass && child.value == refChild.value;
					}
					else if (child.matches("select")) {
						// Compare select options
						$$(child.options).forEach((option, i) => {
							var refOption = refChild.options[i];
							var same = option.textContent == refOption.textContent &&
									   option.value == refOption.value;
							pass = pass && same;
						});
					}
				}
			}

			return pass;
		},

		compareAttribute: function(attribute, td, ref) {
			var actual = $$("*", td).map(el => el[attribute]);
			var expected = $$("*", ref).map(el => el[attribute]);

			return actual.length === expected.length && actual.every((v, i) => {
				return v === expected[i];

			});
		},

		presentCode: function(code) {
			// Remove blank line in the beginning and end
			code = code.replace(/^\s*\n|\n\s*$/g, "");

			// Remove extra indentation
			var indent = (code.match(/^\s*/) || [""])[0];
			code = code.replace(RegExp("^" + indent, "gm"), "");

			code = code.replace(/document.write/g, "print");

			return code;
		}
	}
});

function equals(a, b) {
	if (a === b) {
		return true;
	}

	if (typeof a == "number" && typeof b == "number" && isNaN(a) && isNaN(b)) {
		return true;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.reduce((prev, current, i) => prev && equals(current, b[i]), true);
	}

	return false;
}

// TODO migrate this to the new reftest format
function test_mavoscript() {
	Mavo.hooks.add("expression-eval-error", env => console.log(env.exception));

	var tests = {
		"rewrite": {
			result: test => Mavo.Expression.rewrite(test)
		},
		"function": {
			result: test => (new Mavo.Expression(test)).eval({}),
			expected: expected => eval(expected)
		}
	};

	$$(".tests dt").forEach(dt => {
		var dd = dt.nextElementSibling;

		if (!dd || !dd.matches("dd")) {
			dd = $.create("dd", {
				textContent: dt.textContent,
				after: dt
			});
		}

		dt.classList.remove("error");

		var categoryTests = tests[dt.parentNode.id];

		try {
			var result = categoryTests.result(dt.textContent);
			var expected = categoryTests.expected? categoryTests.expected(dd.textContent) : dd.textContent;
			var pass = equals(result, expected);

			dt.classList.toggle("pass", pass);
			dt.classList.toggle("fail", !pass);

			if (!pass) {
				$.create("dd", {
					textContent: result,
					after: dd
				});
			}
		}
		catch (e) {
			dt.classList.add("error");

			$.create("dd", {
				textContent: e,
				after: dd
			});
		}
	});
}

var preMavo = Mavo.defer();
// So that Mavo cannot init until we get a chance to do stuff
Mavo.ready = Promise.all([Mavo.ready, preMavo]);

$.ready().then(function(){
	var page = location.pathname.match(/\/([a-z]+)(?:\.html|\/$)/)[1];

	// Legacy
	if (typeof self["test_" + page] == "function") {
		self["test_" + page]();
	}

	if (page !== "index") {
		// Create link to home and to remote version
		let h1 = $("body > h1");
		if (h1) {
			$.create("a", {
				className: "home",
				textContent: "Home",
				href: "index.html",
				target: "_top",
				inside: h1
			});

			if (location.hostname == "localhost") {
				var remote = Object.assign(new URL(location), {hostname: "test.mavo.io", port: "80"});
				remote.pathname = remote.pathname.replace(/\/mavo-test/, "");

				$.create("a", {
					className: "remote",
					textContent: "Remote",
					href: remote,
					target: "_top",
					inside: h1
				});
			}
		}

		// Add div for counter at the end of body
		$.create({
			className: "results",
			inside: document.body,
			contents: [
				{
					className: "count-fail",
					onclick: function(evt) {
						Mavo.scrollIntoViewIfNeeded($(".fail"));
					}
				},
				{
					className: "count-pass",
					onclick: function(evt) {
						Mavo.scrollIntoViewIfNeeded($(".interactive"));
					}
				}
			],

		});
	}

	// Add ids to section headers and make them links
	for (let h1 of $$("body > section > h1")) {
		let section = h1.parentNode;

		section.id = section.id || Mavo.Functions.idify(h1.textContent);

		$.create("a", {
			href: "#" + section.id,
			around: h1.firstChild
		});
	}

	var hashchanged = evt => {
		if (location.hash) {
			var target = $(location.hash);

			if (!target) {
				return;
			}

			if (target.matches("body > section")) {
				if (evt) {
					location.reload();
					return true;
				}

				// Isolate this test
				for (let section of $$(`body > section:not(${location.hash})`)) {
					section.remove();
				}

				$.create("p", {
					className: "notice",
					contents: [
						"Some tests hidden. ",
						{
							tag: "a",
							href: "#",
							onclick: evt => location.reload(),
							textContent: "Show all tests"
						}
					],
					start: document.body
				});
			}
		}
	};

	hashchanged();
	onhashchange = hashchanged;

	requestAnimationFrame(() => {
		for (let table of $$("table.reftest")) {
			table.reftest = new RefTest(table);
		}
	});

	preMavo.resolve();
});
