import "./init.mjs";

let tests = await Promise.all([
	"mavoscript"
].map(name => import(`./${name}.mjs`).then(module => module.default)));

export default {
	name: "All Mavo tests",
	tests
};