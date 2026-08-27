/**
 * Le garde-fou, mis a l'epreuve.
 *
 * Une panne d'affichage ne doit pas interrompre celui qui travaille. Le garde
 * se releve seul, en silence, et ne se montre que si la panne s'installe. Ces
 * verifications existent parce que la boite d'erreur, elle, s'etait montree.
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Garde } from "./Garde";

/**
 * Un composant qui echoue tant qu'on ne lui dit pas d'arreter.
 *
 * Le drapeau est volontairement exterieur au composant : React reessaie de
 * lui-meme un rendu qui a echoue, et un compteur decremente a chaque tentative
 * se viderait avant meme que le garde n'ait eu son mot a dire.
 */
function Fragile({ panne }: { panne: { active: boolean } }) {
  if (panne.active) throw new Error("panne d affichage");
  return <p>La scene est la</p>;
}

/** Laisse passer les relevements programmes par le garde. */
async function laisserLeTempsDeSeRelever(fois = 5) {
  for (let tour = 0; tour < fois; tour += 1) {
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
  }
}

describe("le garde-fou de l'interface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // React ecrit l'erreur sur la console : c'est attendu, on n'en veut pas
    // le bruit dans la sortie des tests.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    (window as { __jsErrors?: string[] }).__jsErrors = [];
    (window as { __mentaliisRelevements?: number }).__mentaliisRelevements = 0;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("laisse passer ce qui va bien", () => {
    render(
      <Garde>
        <p>La scene est la</p>
      </Garde>,
    );
    expect(screen.getByText("La scene est la")).toBeTruthy();
  });

  it("se releve seul apres une panne passagere, sans rien montrer", async () => {
    const panne = { active: true };
    render(
      <Garde>
        <Fragile panne={panne} />
      </Garde>,
    );

    // Au moment de la panne, aucune boite d'erreur : juste le fond.
    expect(screen.queryByText("Quelque chose s'est casse")).toBeNull();
    expect(
      (window as { __mentaliisRelevements?: number }).__mentaliisRelevements,
    ).toBeGreaterThan(0);

    // La cause passe, comme le ferait un etat transitoire.
    panne.active = false;
    await laisserLeTempsDeSeRelever();

    expect(screen.getByText("La scene est la")).toBeTruthy();
    expect(screen.queryByText("Quelque chose s'est casse")).toBeNull();
  });

  it("se releve plusieurs fois de suite si besoin, toujours en silence", async () => {
    const panne = { active: true };
    render(
      <Garde>
        <Fragile panne={panne} />
      </Garde>,
    );

    // Deux relevements manques, puis la cause disparait : toujours rien a l'ecran.
    await laisserLeTempsDeSeRelever(2);
    expect(screen.queryByText("Quelque chose s'est casse")).toBeNull();
    panne.active = false;
    await laisserLeTempsDeSeRelever(4);

    expect(screen.getByText("La scene est la")).toBeTruthy();
    expect(screen.queryByText("Quelque chose s'est casse")).toBeNull();
  });

  it("finit par se montrer quand la panne s'installe", async () => {
    const panne = { active: true };
    render(
      <Garde>
        <Fragile panne={panne} />
      </Garde>,
    );

    await laisserLeTempsDeSeRelever(10);

    expect(screen.getByText("Quelque chose s'est casse")).toBeTruthy();
    expect(screen.getByText(/Vos notes et vos positions sont sur le disque/)).toBeTruthy();
  });

  it("garde une trace de chaque panne, meme reparee en silence", async () => {
    const panne = { active: true };
    render(
      <Garde>
        <Fragile panne={panne} />
      </Garde>,
    );
    await laisserLeTempsDeSeRelever(2);
    panne.active = false;
    await laisserLeTempsDeSeRelever(4);

    // Une panne reparee en silence reste une panne : elle doit laisser une trace,
    // sans quoi on ne pourrait jamais la diagnostiquer.
    const traces = (window as { __jsErrors?: string[] }).__jsErrors ?? [];
    expect(traces.length).toBeGreaterThan(0);
    expect(traces[0]).toContain("panne d affichage");
  });

  it("« Reprendre » ramene la scene une fois la panne passee", async () => {
    const panne = { active: true };
    render(
      <Garde>
        <Fragile panne={panne} />
      </Garde>,
    );
    await laisserLeTempsDeSeRelever(10);
    expect(screen.getByText("Quelque chose s'est casse")).toBeTruthy();

    // La cause disparait, puis on reprend.
    panne.active = false;
    await act(async () => {
      screen.getByText("Reprendre").click();
      await Promise.resolve();
    });

    expect(screen.getByText("La scene est la")).toBeTruthy();
  });
});
