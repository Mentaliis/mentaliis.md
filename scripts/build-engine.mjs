/**
 * Fige le moteur Python en un dossier autonome, avant l'empaquetage.
 *
 * Ce script ne sert qu'a la publication. `npm run dev` ne l'appelle jamais :
 * en developpement, la coquille Rust lance toujours l'interpreteur du venv.
 *
 * Il existe pour une seule raison : le chemin de l'interpreteur n'est pas le
 * meme sur Windows et sur macOS, et Mentaliis vise les deux.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const moteur = join(racine, "engine");

const candidats = [
  join(moteur, ".venv", "Scripts", "python.exe"), // Windows
  join(moteur, ".venv", "bin", "python"), // macOS et Linux
];
const python = candidats.find(existsSync);

if (!python) {
  console.error(
    "Aucun environnement Python trouve dans engine/.venv.\n" +
      "Creez-le puis installez les dependances :\n" +
      "  python -m venv engine/.venv\n" +
      "  engine/.venv/Scripts/pip install -e engine[dev]   (Windows)\n" +
      "  engine/.venv/bin/pip install -e 'engine[dev]'     (macOS)",
  );
  process.exit(1);
}

console.log("Moteur : construction du paquet autonome…");
const sortie = spawnSync(
  python,
  ["-m", "PyInstaller", "--noconfirm", "--clean", "mentaliis-engine.spec"],
  { cwd: moteur, stdio: "inherit" },
);

if (sortie.status !== 0) {
  console.error("\nLa construction du moteur a echoue.");
  process.exit(sortie.status ?? 1);
}

// Sans cette verification, l'application s'empaquetterait sans moteur et ne
// montrerait le probleme qu'a la premiere ouverture, chez l'utilisateur.
const binaire = join(
  moteur,
  "dist",
  "mentaliis-engine",
  process.platform === "win32" ? "mentaliis-engine.exe" : "mentaliis-engine",
);
if (!existsSync(binaire)) {
  console.error(`\nMoteur introuvable apres construction : ${binaire}`);
  process.exit(1);
}

console.log(`Moteur pret : ${binaire}`);
