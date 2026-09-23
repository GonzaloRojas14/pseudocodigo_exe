import { readFileSync } from "node:fs";
import { parse } from "../src/parser";
import { columnasDe } from "../src/archivos";
import type { RecordDecl } from "../src/ast";

const p = parse(readFileSync(process.argv[2], "utf8"));
if (!p.program) { console.error("no parsea"); process.exit(1); }
const tipos = new Map<string, RecordDecl>();
for (const d of p.program.declarations) if (d.kind === "record") tipos.set(d.name.toLowerCase(), d);
for (const d of p.program.declarations) {
  if (d.kind !== "var" || d.type.kind !== "archivo") continue;
  for (const nombre of d.names) {
    const cols = columnasDe(d.type.element, tipos, [], d.type.pos).map((c) => c.titulo);
    console.log(`${nombre}\t${cols.join("\t")}`);
  }
}
