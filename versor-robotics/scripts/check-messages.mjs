// Checks that every messages/<locale>.json has exactly the keys of messages/en.json,
// the same {placeholders} and <tags> in each string, and no empty strings.
// Run: npm run check:messages
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "messages");
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));

const flatten = (obj, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

// which placeholders and tags appear (not how often: a translation may break a title over fewer lines)
const tokens = (s) => [...new Set([...String(s).matchAll(/\{\w+\}|<\/?\w+>/g)].map((m) => m[0]))].sort().join(" ");

const en = flatten(load("en.json"));
let problems = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const other = flatten(load(file));
  const report = (msg) => {
    problems++;
    console.log(`${file}: ${msg}`);
  };
  for (const k of Object.keys(en)) {
    if (!(k in other)) report(`missing ${k}`);
    else if (typeof other[k] !== "string" || !other[k].trim()) report(`empty ${k}`);
    else if (tokens(other[k]) !== tokens(en[k])) report(`${k} has "${tokens(other[k])}", English has "${tokens(en[k])}"`);
  }
  for (const k of Object.keys(other)) if (!(k in en)) report(`extra ${k}`);
}

console.log(problems ? `\n${problems} problem(s)` : `All message files match en.json (${Object.keys(en).length} keys).`);
process.exit(problems ? 1 : 0);
