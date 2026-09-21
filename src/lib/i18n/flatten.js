/** `{ home: { title: "x" } }` -> `{ "home.title": "x" }`. Namespace files nest their keys; lookups use the dotted path. */
export function flatten(tree, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}
