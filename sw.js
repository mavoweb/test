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
		navigator.serviceWorker.register("sw.js").catch(e => console.log(e));
	});
}

})();
