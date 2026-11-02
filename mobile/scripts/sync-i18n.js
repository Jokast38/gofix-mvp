// Single source of truth for UI texts: the web dictionaries (frontend/src/i18n). This copies them into the app.
// Run after any translation change:  npm run i18n:sync
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../../frontend/src/i18n");
const DST = path.resolve(__dirname, "../src/i18n/shared");
const FILES = ["fr", "ar", "en"].flatMap((l) => [".js", ".lots.js", ".lots2.js", ".legal.js"].map((part) => `${l}${part}`));

fs.mkdirSync(DST, { recursive: true });
for (const f of FILES) {
  const body = fs.readFileSync(path.join(SRC, f), "utf8");
  fs.writeFileSync(path.join(DST, f), `// AUTO-COPIED from frontend/src/i18n/${f} — edit the web file, then run \`npm run i18n:sync\`.\n${body}`);
}
console.log(`i18n synced: ${FILES.length} dictionaries`);
