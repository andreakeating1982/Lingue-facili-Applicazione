/* Trova il modulo vite che risponde 504 seguendo il grafo degli import. */
const BASE = "https://3000-i9kwbf0p9dxnf8ncon8js.sandbox.easy-peasy.ai";
const seen = new Set();
const bad = [];
let count = 0;

const IMPORT_RE = /import\s*(?:\{[^}]*\}\s*from\s*|[\w$]+\s*from\s*|[\w$]+\s*,\s*)?"([^"]+)"/g;

async function crawl(path, depth) {
  if (seen.has(path) || depth > 8 || count > 400) return;
  seen.add(path);
  count++;
  console.error("VISIT", path);
  let res;
  try {
    res = await fetch(BASE + path);
  } catch (e) {
    bad.push(`${path} -> FETCH ERROR ${e.message}`);
    return;
  }
  if (res.status !== 200) {
    bad.push(`${path} -> ${res.status}`);
    return;
  }
  const clean = path.split("?")[0];
  if (!/\.tsx?$|\.jsx?$|\.css$/.test(clean)) return;
  const body = await res.text();
  const imports = [...body.matchAll(IMPORT_RE)]
    .map((m) => m[1])
    .filter((p) => p.startsWith("/src/") || p.startsWith("./") || p.startsWith("../"));
  for (const imp of imports) {
    const abs = imp.startsWith("/src/")
      ? imp
      : new URL(imp, "https://x" + path.replace(/[^/]*$/, "")).pathname;
    await crawl(abs, depth + 1);
  }
}

const html = await (await fetch(BASE + "/setup")).text();
const entry = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.includes("/src/"));
console.log("entry:", entry);
for (const e of entry) await crawl(e.startsWith("/src") ? e : "/" + e, 0);
console.log(`moduli visti: ${count}`);
console.log(bad.length ? "PROBLEMI:\n" + bad.join("\n") : "NESSUN PROBLEMA");
