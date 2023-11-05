import vm from "vm";
import fs from "fs";

export default function (path, context) {
	context ??= {};
	const data = fs.readFileSync(path);
	vm.runInNewContext(data, context, path);
	return context;
}