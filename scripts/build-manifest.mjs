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

// Le numero de version n'a qu'une source de verite : le package.json de la
// racine. `tauri.conf.json` s'y refere par un chemin plutot que de recopier le
// numero, ce qui evite qu'ils divergent en silence — et que l'updater se taise.
const version = conf.version.endsWith(".json")
  ? JSON.parse(readFileSync(join(racine, "src-tauri", conf.version), "utf8")).version
  : conf.version;
const depot = conf.plugins.updater.endpoints[0]
  .replace("/releases/latest/download/latest.json", "")
  .replace(/^https:\/\/github\.com\//, "");

const bundle = join(racine, "src-tauri", "target", "release", "bundle");

/** Les paquets que sait produire chaque systeme, et le nom que Tauri leur donne. */
// Le moteur Python est fige par PyInstaller pour une architecture donnee : un
// paquet construit sur un Mac Apple Silicon ne tourne pas sur un Mac Intel. On
// n'annonce donc que l'architecture reellement construite, sous peine de
// proposer a quelqu'un une mise a jour qui ne demarrera pas chez lui.
const macCible = process.arch === "arm64" ? "darwin-aarch64" : "darwin-x86_64";

const familles = [
  { dossier: "nsis", suffixe: "-setup.exe", cibles: ["windows-x86_64"] },
  { dossier: "macos", suffixe: ".app.tar.gz", cibles: [macCible] },
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
  // Les constructions precedentes laissent leurs paquets sur place. Sans exiger
  // le numero de version dans le nom, on publierait un manifeste qui annonce la
  // nouvelle version en pointant vers l'ancien fichier — et la mise a jour
  // echouerait chez tout le monde, signature a l'appui.
  const paquets = fichiers.filter((nom) => nom.endsWith(suffixe));
  const paquet = paquets.find((nom) => nom.includes(version));
  if (paquets.length > 0 && !paquet) {
    console.error(
      [
        `Aucun paquet ${suffixe} en version ${version} dans ${dossier}/.`,
        `Trouve : ${paquets.join(", ")}`,
        "Lancez `npm run build` apres avoir monte le numero de version.",
      ].join(String.fromCharCode(10)),
    );
    process.exit(1);
  }
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

// Si un manifeste est deja la — construit sur l'autre systeme, puis rapporte
// ici — on ajoute a ce qu'il contient plutot que de l'ecraser. C'est ainsi
// qu'un seul `latest.json` finit par couvrir Windows et macOS.
const sortie = join(bundle, "latest.json");
try {
  const existant = JSON.parse(readFileSync(sortie, "utf8"));
  if (existant.version === version && existant.platforms) {
    for (const [cle, valeur] of Object.entries(existant.platforms)) {
      if (!platforms[cle]) platforms[cle] = valeur;
    }
  }
} catch {
  // Pas de manifeste precedent, ou illisible : on part de ce qu'on vient de voir.
}

const manifeste = {
  version,
  notes: process.argv[2] ?? `Mentaliis ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(sortie, `${JSON.stringify(manifeste, null, 2)}\n`, "utf8");
console.log(`\nManifeste ecrit : ${sortie}`);
console.log(`\nPublier avec :\n  gh release create v${version} \\`);
console.log(`    "${sortie}" \\`);
console.log(`    <les paquets listes ci-dessus> \\`);
console.log(`    --title "Mentaliis ${version}" --notes "${manifeste.notes}"`);
