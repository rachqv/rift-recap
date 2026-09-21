// Every message file under src/messages/<locale>/. A namespace is the first part of a key ("home.title" is in home.json).
// Adding one means adding it here and importing it in `en.js` (a test checks the two agree with the files on disk).
//
// `CLIENT_NAMESPACES` are the ones client components read; only those are sent to the browser.
export const NAMESPACES = ["badges", "cards", "chart", "clash", "common", "demo", "errors", "forms", "heatmap", "home", "insights", "persona", "players", "quiz", "recap", "rhythm", "search", "share", "squad", "story", "versus"];

export const CLIENT_NAMESPACES = ["chart", "common", "forms", "heatmap", "players", "quiz", "rhythm", "search", "share", "story"];
