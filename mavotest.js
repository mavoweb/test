(function(){

if (!self.document) {
	// We're in a service worker! Oh man, we’re living in the future! 🌈🦄
	if (location.hostname == "localhost") {
		// We're testing locally, use local URLs for Mavo
		self.addEventListener("fetch", function(evt) {
			var url = evt.request.url;

			if (url.indexOf("dev.mavo.io/dist/mavo.") > -1) {
				var response = fetch(new Request(url.replace(/^.+?dev\.mavo\.io/gi, "http://localhost:8000")), evt.request)
				.then(r => r.status < 400? r : Promise.reject())
				.catch(err => fetch(evt.request)); // if that fails, return original request

				evt.respondWith(response);
			}
		});
	}

	return;
}

if ("serviceWorker" in navigator && new URL("sw.js", location).origin === location.origin) {
	window.addEventListener('load', function() {
		navigator.serviceWorker.register("sw.js");
	});
}

})();

(function($){

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

		if ($.type(a) == $.type(b) && a == b) {
			return true;
		}

		if (Array.isArray(a) && Array.isArray(b)) {
			return a.length === b.length && a.reduce((prev, current, i) => prev && Test.equals(current, b[i]), true);
		}

		return false;
	},

	idify: function(readable) {
		return ((readable || "") + "")
			.replace(/\s+/g, "-") // Convert whitespace to hyphens
			.replace(/[^\w-]/g, "") // Remove weird characters
			.toLowerCase();
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

		var test = x => {
			requestAnimationFrame(() => this.test());
		};

		this.observer = new MutationObserver(test);
		this.observe();

		$.events(this.table, "input change click mavo:datachange", test);
		$.events(this.table.closest("[mv-app]"), "mavo:load", test);
	},

	observe: function() {
		this.observerRunning = true;

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
		$$(this.table.tBodies[0].rows).forEach(tr => this.testRow(tr));
	},

	testRow: function(tr) {
		var cells = $$(tr.cells);

		if (!tr.compare) {
			tr.compare = _.getTest(tr.getAttribute("data-test"), this.compare);
		}

		var resultCell;

		if (cells.length) {
			if (this.columns == 3) {
				// Test, actual, expected
				if (cells.length == 1) {
					// expected is the same as test
					resultCell = $.create("td", {after: cells[0]});
					cells.push(resultCell);
				}

				if (cells.length == 2) {
					// missing actual
					resultCell = $.create("td", {after: cells[0]})
					cells.splice(1, 0, resultCell);
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

			try {
				var ret = this.sneak(() => tr.compare(...cells));
			}
			catch(e) {
				ret = e;
				var error = true;
				resultCell.textContent = e + "";
			}

			var error = ret instanceof Error;

			tr.classList.remove("pass", "fail");
			var className = ret && !error? "pass" : "fail";
			tr.classList.add(className);

			if (className == "pass" && !tr.classList.contains("interactive")) {
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

document.addEventListener("DOMContentLoaded", function(){
	var page = location.pathname.match(/\/([a-z]+)(?:\.html|\/$)/)[1];

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

	// Add div for counter at the end of body
	$.create({
		className: "results",
		inside: document.body,
		contents: [
			{
				className: "count-fail",
				onclick: function(evt) {
					var first = $(".fail");
					first.scrollIntoView({behavior: "smooth"});
				}
			},
			{
				className: "count-pass",
				onclick: function(evt) {
					var first = $(".interactive");
					first.scrollIntoView({behavior: "smooth"});
				}
			}
		],

	});

	// HTML tooltips
	var cells = $$("table.reftest td");
	cells.forEach(td => {
		td._.html = td.attributes.length > 0? td.outerHTML : td.innerHTML;
	});

	Promise.all([
		$.include(self.Prism, "https://cdnjs.cloudflare.com/ajax/libs/prism/1.8.1/prism.min.js"),
		$.include(self.tippy, "https://unpkg.com/tippy.js@1.3.0/dist/tippy.js")
	])
	.then(() => $.include(Prism.plugins.NormalizeWhitespace, "https://cdnjs.cloudflare.com/ajax/libs/prism/1.8.1/plugins/normalize-whitespace/prism-normalize-whitespace.min.js"))
	.then(() => {
		tippy(cells, {
			html: td => {
				var pre = $.create("pre")
				var code = $.create("code", {
					textContent: td._.html,
					className: "language-markup",
					inside: pre
				});
				Prism.highlightElement(code);

				return pre;
			},
			arrow: true,
			theme: "light"
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


})(self.Bliss)
