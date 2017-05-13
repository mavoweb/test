(function($){

if (!self.document) {
	// We're in a service worker! Oh man, we’re living in the future! 🌈🦄
	if (location.hostname == "localhost") {
		// We're testing locally, use local URLs for Mavo
		self.addEventListener("fetch", function(evt) {
			var url = evt.request.url;

			if (/\/dev\.mavo\.io\/dist\/mavo/.test(url)) {
				var response = fetch(new Request(url.replace(/^.+?dev\.mavo\.io/gi, "../mavo")), evt.request)
				.then(r => r.status < 400? r : Promise.reject())
				.catch(err => fetch(evt.request)); // if that fails, return original request

				evt.respondWith(response);
			}
		});
	}

	return;
}

var src = document.currentScript ? document.currentScript.src : "test.js";

if ("serviceWorker" in navigator) {
	window.addEventListener('load', function() {
		navigator.serviceWorker.register(src);
	});
}

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

		if (content == "none") {
			return "";
		}

		return content.replace(/^["']|["']$/g, "");
	},

	content: function(node) {
		var ret = "";

		if (node.nodeType == 1) {
			if (getComputedStyle(node).display == "none") {
				return "";
			}

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
				for (let child of $$(node.childNodes)) {
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
		"input, textarea": e => e.value,
		"select": e => e.selectedOptions[0] && e.selectedOptions[0].textContent
	},

	contentIgnore: [".mv-ui"],

	equals: function(a, b) {
		if (a === b) {
			return true;
		}

		if ($.type(a) == $.type(b)) {
			return isNaN(a) && isNaN(b) || a == b;
		}

		if (Array.isArray(a) && Array.isArray(b)) {
			return a.length === b.length && a.reduce((prev, current, i) => prev && Test.equals(current, b[i]), true);
		}

		return false;
	}
};

var _ = self.RefTest = $.Class({
	constructor: function(table) {
		this.table = table;
		this.columns = +this.table.getAttribute("data-columns") || Math.max.apply(Math, $$(this.table.rows).map(row => row.cells.length));
		this.compare = _.getTest(table.getAttribute("data-test"));
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
		var cells = $$(this.table.rows[0].cells);

		if (!$("thead", this.table) && this.columns > 1) {
			var header = ["Test", "Actual", "Expected"].slice(-this.columns);

			$.create("thead", {
				contents: [
					{
						tag: "tr",
						contents: header.map(text => {
							return {tag: "th", textContent: text};
						})
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

		$.events(this.table, "input change click mavo:datachange", test);
		$.events(this.table.closest("[mv-app]"), "mavo:load", test);
	},

	test: function() {
		$$(this.table.tBodies[0].rows).forEach(tr => this.testRow(tr));
	},

	testRow: function(tr) {
		var cells = $$(tr.cells);

		if (!tr.compare) {
			tr.compare = _.getTest(tr.getAttribute("data-test"), this.compare);
		}

		if (cells.length) {
			if (this.columns == 3) {
				// Test, actual, expected
				if (cells.length == 1) {
					// expected is the same as test
					cells.push($.create("td", {after: cells[0]}));
				}

				if (cells.length == 2) {
					// missing actual
					cells.splice(1, 0, $.create("td", {after: cells[0]}));
				}

				if (!cells[2].textContent) {
					cells[2].textContent = cells[0].textContent;
				}
			}
			else if (this.columns == 2 && !cells[0].innerHTML) {
				let previous = tr;
				while (previous = previous.previousElementSibling) {
					if (previous.cells[0].innerHTML) {
						cells[0] = previous.cells[0];
						break;
					}
				}
			}

			tr.classList.remove("pass", "fail");
			tr.classList.add(tr.compare(...cells)? "pass" : "fail");
		}
	},

	static: {
		getTest: function(test, fallback) {
			if (test) {
				if (test in _.compare) {
					return _.compare[test];
				}
				else if (test in self) {
					return self[test];
				}
				else {
					return new Function("td", "ref", test);
				}
			}

			return fallback || _.compare.contents;
		},

		compare: {
			contents: (...cells) => {
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

			attribute: function(attribute, td, ref) {
				var actual = $$("*", td).map(el => el[attribute]);
				var expected = $$("*", ref).map(el => el[attribute]);

				return actual.length === expected.length && actual.every((v, i) => {
					return v === expected[i];

				});
			},

			selector: function(td, ref) {
				if (ref.children.length) {
					// Multiple selectors to test against in a list
					return $$("li", ref).every(li => _.compare.selector(td, li));
				}
				else {
					var negative = ref.classList.contains("not");
					var has = !!$(ref.textContent, td);
					return negative? !has : has;
				}
			},

			elements: function(td, ref) {
				var elements = $$("*", td);

				return $$("*", ref).every((refElement, i) => {
					var element = elements[i];

					return element.nodeName == refElement.nodeName
							&& $$(refElement.attributes).every(attr => element.getAttribute(attr.name) === attr.value)
							&& Test.content(element).trim() == Test.content(refElement).trim()
				})
			}
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

Mavo.dependencies.push($.ready().then(function(){
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
		$$("table.reftest").forEach(table => table.reftest = new RefTest(table));
	});
}));


})(self.Bliss)
