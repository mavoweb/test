/* globals Mavo */
import execfile from "./util/execfile.mjs";

// Test dependencies
const deps = ["util", "actions", "functions", "mavoscript"]; // Order matters
for (const dep of deps) {
	execfile(`../../mavo/src/${dep}.js`, {...globalThis });
}

export default {
	name: "MavoScript",
	description: "These tests check if MavoScript is rewritten to JS correctly",
	run: Mavo.Script.rewrite,
	tests: [
		{
			name: "Expression Rewrite",
			tests: [
				{
					args: "1 + 1",
					expect: "$fn.addition(1, 1)"
				},
				{
					name: "Operator flattening",
					args: "1 + 2 + 3",
					expect: "$fn.addition(1, 2, 3)"
				},
				{
					args: "!foo",
					expect: "$fn.not(foo)"
				},
				{
					name: "Do not parse as “not” operator",
					args: "notes",
					expect: "notes"
				},
				{
					args: "-1",
					expect: "$fn.minus(1)"
				},
				{
					args: "+1",
					expect: "$fn.plus(1)"
				},
				{
					args: "if(2, 3, 4)",
					expect: "$fn.iff(2, 3, 4)"
				},
				{
					args: "foo and 5 or baz",
					expect: "$fn.or($fn.and(foo, 5), baz)"
				},
				{
					name: "Do not parse as “and” operator",
					args: "bands",
					expect: "bands"
				},
				{
					args: `"foo"`,
					expect: `"foo"`
				},
				{
					args: "if(foo >= 5, 1, 2)",
					expect: "$fn.iff($fn.gte(foo, 5), 1, 2)"
				},
				{
					args: `foo == "bar"`,
					expect: `$fn.eq(foo, "bar")`
				},
				{
					name: "Single character equals",
					args: "foo = 5",
					expect: "$fn.eq(foo, 5)"
				},
				{
					args: "foo > bar",
					expect: "$fn.gt(foo, bar)"
				},
				{
					name: "3 operand comparison",
					args: "foo > bar > baz",
					expect: "$fn.gt(foo, bar, baz)"
				},
				{
					name: "3 operand equality",
					args: "foo = bar = baz",
					expect: "$fn.eq(foo, bar, baz)"
				},
				{
					name: "4 operand equality",
					args: "foo = bar = baz = yolo",
					expect: "$fn.eq(foo, bar, baz, yolo)"
				},
				{
					name: "4 operand equality",
					args: "foo = bar = baz == yolo",
					expect: "$fn.eq(foo, bar, baz, yolo)"
				},
				{
					name: "4 operand heterogeneous comparison",
					args: "foo > bar >= baz < yolo",
					expect: `$fn.compare(foo, "gt", bar, "gte", baz, "lt", yolo)`
				},
				{
					name: "4 operand heterogeneous equality and comparison",
					args: "foo > bar = baz <= yolo",
					expect: `$fn.compare(foo, "gt", bar, "eq", baz, "lte", yolo)`
				},
				{
					args: "foo != bar",
					expect: "$fn.neq(foo, bar)"
				},
				{
					args: "foo != bar != baz",
					expect: "$fn.neq(foo, bar, baz)"
				},
				{
					args: "foo & bar & baz",
					expect: "$fn.concatenate(foo, bar, baz)"
				},
				{
					args: "foo.bar",
					expect: `$fn.get(foo, "bar")`
				},
				{
					args: "foo.bar.baz[0]",
					expect: `$fn.get(foo, "bar", "baz", 0)`
				},
				{
					args: "foo.bar()",
					expect: "foo.bar()"
				},
				{
					args: "foo[bar]",
					expect: "$fn.get(foo, bar)"
				},
				{
					args: `foo["bar"]`,
					expect: `$fn.get(foo, "bar")`
				},
				{
					args: "foo.bar + 1",
					expect: `$fn.addition($fn.get(foo, "bar"), 1)`
				},
				{
					args: `foo: "bar"`,
					expect: `$fn.keyvalue("foo", "bar")`
				},
				{
					args: `"foo": "bar"`,
					expect: `$fn.keyvalue("foo", "bar")`
				},
				{
					args: `"foo": "bar" : "baz"`,
					expect: `$fn.keyvalue("foo", "bar", "baz")`
				},
				{
					args: "this.prop",
					expect: `$fn.get($this, "prop")`
				},
				{
					args: "task where done",
					expect: `$fn.filter(task, ${Mavo.Script.serializeScopeCall(["task", "done"])})`
				},
				{
					args: "person where age > 6",
					expect: `$fn.filter(person, ${Mavo.Script.serializeScopeCall(["person", "$fn.gt(age, 6)"])})`
				},
				{
					args: "person where age > 6 where gender = 'female'",
					expect: `$fn.filter(person, ${Mavo.Script.serializeScopeCall(["person", "$fn.gt(age, 6)"])}, ${Mavo.Script.serializeScopeCall(["person", "$fn.eq(gender, 'female')"])})`
				},
				{
					args: "1 .. 5",
					expect: "$fn.range(1, 5)"
				},
				{
					name: "Regular JS",
					args: "foo.filter(a => a + 5)",
					throws: true
				},
				{
					name: "Regular JS",
					args: "/* js */ 5+5",
					throws: true
				},
				{
					name: "Context-sensitive functions",
					args: "duration(1)",
					expect: "$fn.duration.call($this, 1)"
				},
			]
		},
		{
			name: "Function Rewrite",
			description: "These tests check if functions are rewritten to JS correctly",
			tests: [
				{
					name: "Normal function",
					args: "count(foo)",
					expect: "$fn.count(foo)"
				},
				{
					name: "Normal function, explicit $fn",
					args: "$fn.range(1, 5)",
					expect: "$fn.range(1, 5)"
				},
				{
					name: "Rewrite function that clashes with prototype function",
					args: "split(solution)",
					expect: "$fn.split(solution)"
				},
				{
					name: "Member",
					args: "foo.slice()",
					expect: "foo.slice()"
				},
				{
					name: "Global",
					args: `CSS.supports("filter")`,
					expect: `CSS.supports("filter")`
				},
				{
					name: "Multiple levels",
					args: "document.body.firstChild.contains(foo)",
					expect: "document.body.firstChild.contains(foo)"
				},
			]
		},
	]
};