(function($, $$){

self.Test = {
	runSelected: function(names) {
		iframes.innerHTML = "";

		let tests = names.map(name => {
			return $.create("iframe", {
				inside: iframes,
				src: name,
				events: {
					load: evt => {
						updateTotals();

						evt.target.contentWindow.document.addEventListener("testresultsupdate", evt => {
							updateTotals();
						});
					}
				}
			});
		});

		function updateTotals() {
			let totals = {pass: 0, fail: 0};

			tests.forEach(iframe => {
				let doc = iframe.contentDocument;

				if (doc.readyState !== "complete" || !$("body > nav", doc)) {
					return;
				}

				totals.pass += +$("body > nav .count-pass .count", doc).textContent;
				totals.fail += +$("body > nav .count-fail .count", doc).textContent;
			});

			let totalsEl = $("h1 + .totals") || $.create({className: "totals", after: $("h1")});

			totalsEl.innerHTML = `<strong>${totals.pass}</strong> passing, <strong>${totals.fail}</strong> failing of ${totals.pass + totals.fail} total`
		}


	},

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

			if (node.matches(Test.contentIgnore.join(", "))) {
				return "";
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
		"select": e => {
			return [...e.selectedOptions].map(o => o.textContent).join("\n");
		}
	},

	contentIgnore: [".mv-ui", "script", ".test-content-ignore"],

	equals: function(a, b) {
		if (a === b) {
			return true;
		}

		var type = $.type(a);

		if (type == $.type(b)) {
			if (a == b) {
				return true;
			}

			if (Array.isArray(a) && Array.isArray(b)) {
				return a.length === b.length && a.reduce((prev, current, i) => prev && Test.equals(current, b[i]), true);
			}

			if (type == "object") {
				var test = $.extend({}, a, Object.keys(b));
				return JSON.stringify(test) == JSON.stringify(b);
			}
		}

		return false;
	},

	idify: function(readable) {
		return ((readable || "") + "")
			.replace(/\s+/g, "-") // Convert whitespace to hyphens
			.replace(/[^\w-]/g, "") // Remove weird characters
			.toLowerCase();
	},

	// Stringify object in a useful way
	format: (obj) => {
		var type = $.type(obj);

		if (obj && obj[Symbol.iterator] && type != "string") {
			var arr = [...obj];

			if (obj && arr.length > 1) {
				return arr.map(o => Test.format(o)).join(" ");
			}
			else if (arr.length == 1) {
				obj = arr[0];
			}
			else {
				return `(empty ${type})`;
			}
		}

		if (obj instanceof HTMLElement) {
			return obj.outerHTML;
		}

		var toString = obj + "";

		if (!/\[object \w+/.test(toString)) {
			// Has reasonable toString method, return that
			return toString;
		}

		return JSON.stringify(obj, function(key, value) {
			switch ($.type(value)) {
				case "set":
					return {
						type: "Set",
						value: [...value]
					};
				default:
					return value;
			}
		}, "\t");
	},

	print: async function print(...texts) {
		var script = this instanceof HTMLElement && this.matches("script")? this : document.currentScript;

		for (let text of texts) {
			if (typeof text === "function") {
				await $.ready();
				text = text();
			}

			text = Test.format(text);

			if (document.readyState == "loading") {
				document.write(text);
			}
			else if (script && script.parentNode) {
				script.insertAdjacentHTML("afterend", text);
			}
			else {
				console.log("Test print", text);
			}
		}
	},

	println: (...text) => {
		Test.print(...text);
		Test.print(" ", document.createElement("br"));
	},

	async: function(callback) {
		var script = document.currentScript;
		callback(Test.print.bind(script));
	}
};

var _ = self.RefTest = $.Class({
	constructor: function(table) {
		this.table = table;
		this.columns = +this.table.getAttribute("data-columns") || Math.max.apply(Math, $$(this.table.rows).map(row => row.cells.length));
		this.compare = _.getTest(table.getAttribute("data-test"));
		this.setup();
		this.startup = performance.now();
		this.test();
	},

	setup: function() {
		// Remove any <script> elements to prevent them messing up the contents. They've already been processed anyway.
		// Keep them in an attribute though, as they may be useful to display
		for (var script of $$("script", this.table)) {
			$.remove(script);
		}

		if (this.table.rows.length === 0) {
			console.warn("Empty reftest:", this.table);
			return;
		}

		// Add table header if not present
		var cells = $$(this.table.rows[0].cells);

		if (!$("thead", this.table) && this.columns > 1) {
			var header = [...Array(Math.max(0, this.columns - 2)).fill("Test"), "Actual", "Expected"].slice(-this.columns);

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

		var test = x => {
			requestAnimationFrame(() => this.test());
		};

		this.observer = new MutationObserver(test);
		this.observe();

		$.events(this.table, "input change click mv-change", test);
		$.events(this.table.closest("[mv-app]"), "mv-load", test);

		$$("[data-click]", this.table)
			.concat(this.table.matches("[data-click]")? [this.table] : [])
			.forEach(target => {
				var clicks = target.getAttribute("data-click").trim().split(/\s*,\s*/).map(_.parseClick);

				clicks.forEach(click => {
					var event = click.event? new Promise(resolve => target.addEventListener(click.event, resolve)) : Promise.resolve();

					event.then(evt => {
						var delay = click.delay? new Promise(resolve => setTimeout(resolve, click.delay)) : Promise.resolve();

						delay.then(() => {
							var targets = click.selector? $$(click.selector, target) : [target];

							targets.forEach(el => {
								for (let i=0; i<click.times; i++) {
									el.click();
								}
							});
						});
					});
				});
			});
	},

	observe: function() {
		this.observerRunning = true;

		// TODO move this somewhere else, it's Mavo specific
		this.observer.observe(this.table, {
			subtree: true,
			childList: true,
			attributes: true,
			characterData: true,
			attributeFilter: ["mv-mode"]
		});
	},

	unobserve: function() {
		this.observer.disconnect();
		this.observerRunning = false;
	},

	// Run code past observer
	sneak: function(callback) {
		this.unobserve();
		var ret = callback.call(this);
		this.observe();
		return ret;
	},

	test: function() {
		RefTest.hooks.run("reftest-test", this);

		for (let tr of this.table.rows) {
			if (!this.table.tHead || tr !== this.table.tHead.rows[0]) {
				this.testRow(tr);
			}
		}
	},

	testRow: function(tr) {
		let env = {context: this, tr, cells: $$(tr.cells)};
		RefTest.hooks.run("reftest-testrow", env);

		if (!env.tr.compare) {
			env.tr.compare = _.getTest(env.tr.getAttribute("data-test"), this.compare);
		}

		var resultCell;

		if (env.cells.length) {
			if (this.columns == 3) {
				// Test, actual, expected
				if (env.cells.length == 1) {
					// expected is the same as test
					resultCell = $.create("td", {after: env.cells[0]});
					env.cells.push(resultCell);
				}

				if (env.cells.length == 2) {
					// missing actual
					resultCell = $.create("td", {after: env.cells[0]});
					env.cells.splice(1, 0, resultCell);
				}

				if (!env.cells[2].textContent) {
					env.cells[2].textContent = env.cells[0].textContent;
				}
			}
			else if (this.columns == 2 && !env.cells[0].innerHTML) {
				let previous = env.tr;
				while (previous = previous.previousElementSibling) {
					if (previous.cells[0].innerHTML) {
						env.cells[0] = previous.cells[0];
						break;
					}
				}
			}

			try {
				var ret = this.sneak(() => tr.compare(...env.cells));
			}
			catch (e) {
				ret = e;
				var error = true;
				resultCell.textContent = e + "";
			}

			var error = ret instanceof Error;

			var previousClass = tr.classList.contains("pass")? "pass" : "fail";
			tr.classList.remove("pass", "fail");
			let pass = ret;
			if (error) {
				pass = tr.hasAttribute("data-error");
			}

			var className = pass? "pass" : "fail";
			tr.classList.add(className);

			if (className == "pass" && className != previousClass && !tr.classList.contains("interactive")) {
				// Display how long it took
				var time = performance.now() - this.startup;
				var unit = "ms";

				time = +time.toFixed(2);

				if (time > 100) {
					time = Math.round(time);
				}

				if (time > 1000) {
					time /= 1000;
					unit = "s";
				}

				tr.setAttribute("data-time", time + unit);
			}

			_.updateResults();
		}
	},

	static: {
		hooks: new $.Hooks(),

		// Retrieve the comparator function based on a data-test string
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

		// Default comparison functions
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

			// Compares numbers to 3 significant digits if no argument is passed,
			// If argument is passed, returns a comparison function for that number of significant digits
			fuzzyNumbers: function(precision, ...cells) {
				let comparator = (...cells) => {
					let rNumber = /-?\d*\.?\d+(e-?\d+)?|NaN/g

					let contents;
					if (cells[0] instanceof Node) {
						contents = cells.map(c => c.textContent);
					}
					else {
						contents = cells;
					}

					let ref = contents.pop();
					let test = contents.pop();

					let refNumbers = [];
					ref = ref.replace(rNumber, n => {
						refNumbers.push(+n);
						return "";
					});

					let testNumbers = [];
					test = test.replace(rNumber, n => {
						testNumbers.push(+n);
						return "";
					});

					ref = ref.trim().replace(/\s+/g, " ");
					test = test.trim().replace(/\s+/g, " ");

					if (ref !== test || refNumbers.length !== testNumbers.length) {
						return false;
					}

					// Pairwise subtract numbers
					let ε = .1 ** precision;
					let ret = refNumbers.every((n, i) => {
						let n_t = testNumbers[i];
						if (Number.isNaN(n_t)) {
							return Number.isNaN(n);
						}

						return Math.abs(n - n_t) < ε;
					});

					return ret;
				};

				if (!Number.isInteger(precision)) {
					cells.unshift(precision);
					// No precision passed, do comparison with precision = 4
					precision = 4;
				}

				return comparator(...cells);
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
							&& Test.content(element).trim() == Test.content(refElement).trim();
				});
			}
		},

		// Prettify code for presentation
		presentCode: function(code) {
			// Remove blank line in the beginning and end
			code = code.replace(/^\s*\n|\n\s*$/g, "");

			// Remove extra indentation
			var indent = (code.match(/^\s*/) || [""])[0];
			code = code.replace(RegExp("^" + indent, "gm"), "");

			code = code.replace(/document.write/g, "print");

			return code;
		},

		updateResults: function() {
			_.results = {
				pass: $$("table.reftest:not(.ignore) tr.pass:not(.ignore)"),
				fail: $$("table.reftest:not(.ignore) tr.fail:not(.ignore)"),
				current: {
					pass: -1,
					fail: -1
				}
				// interactive: $$("table.reftest tr.interactive")
			};

			var detail = {
				pass: _.results.pass.length,
				fail: _.results.fail.length
			};

			$(".count-pass .count", _.nav).textContent = detail.pass;
			$(".count-fail .count", _.nav).textContent = detail.fail;

			$.style(_.nav, {
				"--pass": detail.pass,
				"--fail": detail.fail,
				"--page": `"${Test.currentPage}"`
			});

			// $(".count-interactive", _.nav).textContent = _.results.interactive.length;

			document.dispatchEvent(new CustomEvent("testresultsupdate", {detail}));
		},

		// Navigate tests
		navigateTests: function(type = "fail", offset) {
			var elements = _.results[type];
			var i = _.results.current[type] + offset;

			if (!elements.length) {
				return;
			}

			if (i >= elements.length) {
				i = 0;
			}
			else if (i < 0) {
				i = elements.length - 1;
			}

			var countElement = $(".count-" + type, _.nav);

			if (elements.length > 1) {
				$(".nav", countElement).hidden = false;
				$(".current", countElement).textContent = i + 1;
			}

			var target = elements[i];

			target.scrollIntoView({behavior: "smooth"});

			_.results.current[type] = i;
		},

		next: function(type = "fail") {
			_.navigateTests(type, 1);
		},

		previous: function(type = "fail") {
			_.navigateTests(type, -1);
		},

		/**
		 * Parse data-click text into a meaningful structure
		 * Examples:
		   .mv-bar .mv-save wait 5s after load"
		   .mv-bar .mv-save wait 3s" (no event, DOMContentLoaded assumed)
		    wait 1s after load" (no selector, element assumed)
		  */
		parseClick: function(click) {
			var ret = {times: 1};

			click = click.replace(/wait ([\d.]+)s/i, ($0, $1) => {
				ret.delay = $1 * 1000;
				return "";
			});

			click = click.replace(/after ([\w:-]+)\s*$/i, ($0, $1) => {
				ret.event = $1;
				return "";
			});

			click = click.replace(/(\d+) times/i, ($0, $1) => {
				ret.times = $1;
				return "";
			});

			ret.selector = click.trim();

			return ret;
		}
	}
});

for (let i = 0; i < 10; i++) {
	RefTest.compare["fuzzyNumbers" + i] = RefTest.compare.fuzzyNumbers//.bind(RefTest.compare, i);
}

document.addEventListener("dblclick", evt => {
	if (evt.altKey) {
		let test = evt.target.closest(".reftest > tbody > tr");

		if (test) {
			location.hash = test.id;
		}
	}
})

document.addEventListener("DOMContentLoaded", function(){
	if (/\/$/.test(location.pathname)) {
		Test.currentPage = "index";
	}
	else {
		Test.currentPage = (location.pathname.match(/\/([a-z-]+)(?:\.html|\/?$)/) || [, "index"])[1];
	}

	if (Test.currentPage == "index") {
		return;
	}

	// Add ids to section headers and make them links
	for (let h1 of $$("body > section > h1")) {
		let section = h1.parentNode;

		section.id = section.id || Test.idify(h1.textContent);

		$.create("a", {
			href: "#" + section.id,
			around: h1.firstChild
		});
	}

	// Add ids to all tests
	$$(`.reftest > tbody > tr`).forEach((test, i) => {
		if (!test.id) {
			test.id = Test.idify(test.title) || "test-" + (i + 1);
		}
	});

	var hashchanged = evt => {
		if (location.hash) {
			var target = $(location.hash);

			if (!target) {
				return;
			}

			let isSection = target.matches("body > section");
			let isTest = target.matches(".reftest > tbody > tr");

			if (isSection || isTest) {
				if (evt) {
					// Hash was changed manually, reload to resolve properly
					location.reload();
					return true;
				}

				let targetSection = isSection ? target : target.closest("section");
				let targetSectionId = targetSection.id;

				// Isolate this test
				for (let section of $$(`body > section`)) {
					if (section.id !== targetSection.id) {
						section.remove();
					}
				}

				if (isTest) {
					for (let test of $$(`.reftest > tbody > tr`)) {
						if (test.id !== target.id) {
							test.remove();
						}
					}
				}

				$.create("p", {
					className: "notice",
					contents: [
						"Some tests hidden. ",
						{
							tag: "a",
							href: "#",
							onclick: evt => {
								location.hash = "#";
								location.reload();
							},
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

	// Add div for counter at the end of body
	_.nav = $.create({
		tag: "nav",
		inside: document.body,
		contents: [
			window === parent? {
				tag: "a",
				className: "home",
				title: "Home",
				textContent: "🏠",
				href: "index.html",
				target: "_top"
			} : undefined,
			...["fail", "pass"].map(type => {
				return {
						className: "count-" + type,
						contents: [
							{className: "count"},
							{
								className: "nav",
								hidden: true,
								contents: [
									{
										tag: "button", type: "button",
										className: "previous", textContent: "◂",
										onclick: evt => {
											RefTest.previous(type);
											evt.stopPropagation();
										}
									},
									{className: "current"},
									{
										tag: "button", type: "button",
										className: "next", textContent: "▸",
										onclick: evt => {
											RefTest.next(type);
											evt.stopPropagation();
										}
									}
								]
							}
						],
						onclick: RefTest.next.bind(RefTest, type)
					};
			})
		]
	});

	// HTML tooltips
	var cellHTML = new WeakMap();
	var cells = $$("table.reftest td");
	cells.forEach(td => {
		cellHTML.set(td, td.attributes.length > 0? td.outerHTML : td.innerHTML);
	});

	Promise.all([
		$.include(self.Prism, "https://cdnjs.cloudflare.com/ajax/libs/prism/1.8.1/prism.min.js"),
		$.include(self.tippy, "https://unpkg.com/tippy.js@1/dist/tippy.js")
	])
	.then(() => $.include(Prism.plugins.NormalizeWhitespace, "https://cdnjs.cloudflare.com/ajax/libs/prism/1.8.1/plugins/normalize-whitespace/prism-normalize-whitespace.min.js"))
	.then(() => {
		var t = tippy(cells, {
			html: td => {
				var pre = $.create("pre")
				var code = $.create("code", {
					textContent: cellHTML.get(td),
					className: "language-markup",
					inside: pre
				});
				Prism.highlightElement(code);

				return pre;
			},
			arrow: true,
			theme: "light",
			maxWidth: "50em"
		});

		t.store.forEach(instance => {
			$.events(instance.el, "mouseover mouseenter", function(evt) {
				if (evt.target != this) {
					var popper = t.getPopperElement(this);
					t.hide(popper);
				}
			});
		});
	});

	loadCSS("https://cdnjs.cloudflare.com/ajax/libs/prism/1.8.1/themes/prism.css");
	loadCSS("https://unpkg.com/tippy.js@1.3.0/dist/tippy.css");

	requestAnimationFrame(() => {
		$$("table.reftest").forEach(table => table.reftest = new RefTest(table));
	});
});

function loadCSS(url) {
	return $.fetch(url).then(() => $.create("link", {
		"href": url,
		"rel": "stylesheet",
		"inside": document.head
	}));
}

self.print = Test.print;
self.println = Test.println;
self.$ = $;
self.$$ = $$;

})(self.Bliss, Bliss.$);

document.addEventListener("DOMContentLoaded", function(){
	var page = location.pathname.match(/\/([a-z]+)(?:\.html|\/?$)/)[1];

	if (page !== "index") {
		// Create link to home and to remote version
		let h1 = $("body > h1");

		if (h1) {
			if (location.hostname == "localhost") {
				var remote = Object.assign(new URL(location), {hostname: "test.mavo.io", port: "80"});
				remote.pathname = remote.pathname.replace(/\/mavo(-|\/)test/, "");

				$.create("a", {
					className: "remote",
					textContent: "Remote",
					href: remote,
					target: "_top",
					inside: h1
				});
			}
		}
	}
});
