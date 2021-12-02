

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
