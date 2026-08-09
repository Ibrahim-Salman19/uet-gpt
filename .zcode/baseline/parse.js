const fs = require("fs");
const path = require("path");
const file = process.argv[2];
const raw = fs.readFileSync(file, "utf8");
// vitest JSON reporter sometimes prefixes with logs; find first '{'
const start = raw.indexOf("{");
const r = JSON.parse(raw.slice(start));
const failed = (r.testResults || []).flatMap((f) =>
  (f.assertionResults || [])
    .filter((t) => t.status === "failed")
    .map((t) => ({
      file: f.name.split(/[\\/]/).reduce((acc, part, i, arr) => {
        if (arr.slice(i).join("/").startsWith("tests/")) return arr.slice(i).join("/");
        return acc;
      }, f.name),
      name: t.fullName,
    })),
);
console.log("TOTAL FAILED:", failed.length);
console.log("---");
failed.forEach((f, i) => console.log(`${i + 1}. ${f.file} :: ${f.name}`));
