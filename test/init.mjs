import { JSDOM } from "jsdom";
import jsep from "../../mavo/lib/jsep.min.js";

globalThis.self = globalThis;

// DOM
const window = (new JSDOM("", { pretendToBeVisual: false })).window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.addEventListener = window.addEventListener;
globalThis.location = window.location;

// Global dependencies
globalThis.jsep = jsep; // JSEP
await import("../../mavo/lib/bliss.shy.min.js"); // Bliss

// Mock Mavo object
globalThis.Mavo = {
	ready: Promise.resolve(),
	attributes: [],
	observe () {}
};