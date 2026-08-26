/**
 * Ecrit le `latest.json` que Mentaliis interroge pour se mettre a jour.
 *
 * Tauri produit les paquets et leurs signatures, mais pas ce manifeste : c'est
 * lui qui dit a l'application quelle version existe, ou la telecharger, et avec
 * quelle signature la verifier. Sans lui, l'updater ne trouve rien.
 *
 * A lancer apres `npm run build`, puis a joindre a la publication GitHub avec
 * les paquets eux-memes :
 *
 *     node scripts/build-manifest.mjs "Ce qui change dans cette version."
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(readFileSync(join(racine, "src-tauri", "tauri.conf.json"), "utf8"));
const version = conf.version;
const depot = conf.plugins.updater.endpoints[0]
  .replace("/releases/latest/download/latest.json", "")
  .replace(/^https:\/\/github\.com\//, "");

const bundle = join(racine, "src-tauri", "target", "release", "bundle");

/** Les paquets que sait produire chaque systeme, et le nom que Tauri leur donne. */
const familles = [
  { dossier: "nsis", suffixe: "-setup.exe", cibles: ["windows-x86_64"] },
  { dossier: "macos", suffixe: ".app.tar.gz", cibles: ["darwin-x86_64", "darwin-aarch64"] },
  { dossier: "appimage", suffixe: ".AppImage", cibles: ["linux-x86_64"] },
];

const platforms = {};

for (const { dossier, suffixe, cibles } of familles) {
  let fichiers;
  try {
    fichiers = readdirSync(join(bundle, dossier));
  } catch {
    // Ce systeme n'a pas ete construit sur cette machine : c'est normal.
    continue;
  }
  const paquet = fichiers.find((nom) => nom.endsWith(suffixe));
  const signature = fichiers.find((nom) => nom === `${paquet}.sig`);
  if (!paquet || !signature) continue;

  const valeur = {
    signature: readFileSync(join(bundle, dossier, signature), "utf8").trim(),
    url: `https://github.com/${depot}/releases/download/v${version}/${paquet}`,
  };
  for (const cible of cibles) platforms[cible] = valeur;
  console.log(`  ${cibles.join(", ")} : ${paquet}`);
}

if (Object.keys(platforms).length === 0) {
  console.error(
    "Aucun paquet signe trouve. Lancez d'abord `npm run build`,\n" +
      "avec TAURI_SIGNING_PRIVATE_KEY renseignee.",
  );
  process.exit(1);
}

const manifeste = {
  version,
  notes: process.argv[2] ?? `Mentaliis ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

const sortie = join(bundle, "latest.json");
writeFileSync(sortie, `${JSON.stringify(manifeste, null, 2)}\n`, "utf8");
console.log(`\nManifeste ecrit : ${sortie}`);
console.log(`\nPublier avec :\n  gh release create v${version} \\`);
console.log(`    "${sortie}" \\`);
console.log(`    <les paquets listes ci-dessus> \\`);
console.log(`    --title "Mentaliis ${version}" --notes "${manifeste.notes}"`);
