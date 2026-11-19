// Palmera City — make.fun submission program (Node 22, stdlib only).
// Copies the game and its screenshots into the output directory, then
// asks the kit library to build the dossier that describes the entry.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
for (const name of ["game", "screenshots"]) {
  const from = join(here, name);
  if (existsSync(from)) cpSync(from, join(out, name), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, "dossier.json"), JSON.stringify(dossier, null, 2));
console.log(`Palmera City dossier written to ${join(out, "dossier.json")}`);
