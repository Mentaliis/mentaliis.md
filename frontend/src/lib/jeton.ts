/**
 * Reconnaitre son propre moteur.
 *
 * Le moteur ecoute sur un port fixe. Si ce port est deja pris — un second
 * Mentaliis, un moteur de developpement reste ouvert — celui que la fenetre
 * vient de lancer meurt sans bruit, et la fenetre se met a parler a l'autre.
 * Elle afficherait alors un tout autre Vault que celui attendu, et deux
 * applications ecriraient dans le meme fichier de mise en page.
 *
 * La coquille tire un jeton a chaque lancement et le transmet au moteur
 * qu'elle demarre. Les deux doivent dire le meme.
 */

/** Vrai seulement dans la fenetre native. */
function dansLApplication(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Le jeton que le moteur devrait porter, ou `null` s'il n'y a rien a verifier.
 *
 * En developpement, le moteur est souvent lance a la main dans un terminal :
 * il n'a pas de jeton, et ce n'est pas une anomalie.
 */
export async function jetonAttendu(): Promise<string | null> {
  if (!dansLApplication()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const jeton = await invoke<string>("jeton_moteur");
    return typeof jeton === "string" && jeton ? jeton : null;
  } catch {
    // Une coquille plus ancienne ne connait pas cette commande : plutot que de
    // bloquer l'application, on renonce a la verification.
    return null;
  }
}
