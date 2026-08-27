/**
 * Le garde-fou de l'interface.
 *
 * Sans lui, la moindre erreur pendant un rendu decroche tout l'arbre React :
 * l'ecran devient noir, sans un mot, et rien n'indique ce qui s'est passe ni
 * comment revenir.
 *
 * Mais montrer une boite d'erreur reste une interruption. Le plus souvent, une
 * panne d'affichage est passagere — un etat transitoire, une donnee arrivee
 * dans le desordre — et il suffit de remonter l'arbre pour qu'elle disparaisse.
 * Le garde tente donc de se relever seul, sans rien dire. Il ne se montre que
 * si la panne revient aussitot, signe qu'elle ne passera pas d'elle-meme.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  panne: Error | null;
  ou: string;
  /** Change a chaque relevement : remonte l'arbre entier, etat compris. */
  generation: number;
}

/** Combien de fois se relever sans rien dire avant de s'avouer vaincu. */
const RELEVEMENTS_SILENCIEUX = 3;

/** Deux pannes plus espacees que cela ne sont pas la meme panne. */
const MEMOIRE_MS = 10_000;

export class Garde extends Component<Props, State> {
  state: State = { panne: null, ou: "", generation: 0 };

  /** Les pannes recentes, pour distinguer un accident d'une panne installee. */
  private recentes: number[] = [];
  private minuterie: number | undefined;

  static getDerivedStateFromError(panne: Error): Partial<State> {
    return { panne };
  }

  componentDidCatch(panne: Error, info: ErrorInfo) {
    // Les suites de verification lisent cette liste : une panne ne doit jamais
    // passer inapercue, meme quand l'ecran, lui, se rattrape.
    const fenetre = window as { __jsErrors?: string[]; __mentaliisRelevements?: number };
    const registre = fenetre.__jsErrors ?? [];
    registre.push(`rendu : ${panne.message}`);
    fenetre.__jsErrors = registre;

    const maintenant = Date.now();
    this.recentes = [...this.recentes, maintenant].filter((t) => maintenant - t < MEMOIRE_MS);

    if (this.recentes.length <= RELEVEMENTS_SILENCIEUX) {
      // On se releve sans rien dire. Le delai croissant laisse le temps a ce
      // qui a rate — une reponse en retard, un fichier en cours d'ecriture —
      // de se terminer avant la nouvelle tentative.
      fenetre.__mentaliisRelevements = (fenetre.__mentaliisRelevements ?? 0) + 1;
      const attente = 120 * this.recentes.length;
      window.clearTimeout(this.minuterie);
      this.minuterie = window.setTimeout(() => {
        this.setState((precedent) => ({
          panne: null,
          ou: "",
          generation: precedent.generation + 1,
        }));
      }, attente);
      return;
    }

    // La panne revient : elle ne passera pas seule. On la montre.
    this.setState({ ou: (info.componentStack ?? "").split("\n").slice(1, 5).join("\n") });
  }

  componentWillUnmount() {
    window.clearTimeout(this.minuterie);
  }

  private reprendre = () => {
    this.recentes = [];
    this.setState((precedent) => ({
      panne: null,
      ou: "",
      generation: precedent.generation + 1,
    }));
  };

  render() {
    const { panne, ou, generation } = this.state;

    // Tant qu'on se releve en silence, on ne montre rien plutot qu'un ecran
    // d'erreur qui clignoterait le temps d'un battement de cil.
    if (panne && this.recentes.length <= RELEVEMENTS_SILENCIEUX) {
      return <div className="garde-silence" aria-hidden="true" />;
    }

    if (!panne) {
      // La generation force React a reconstruire tout l'arbre : un etat reste
      // en travers ne peut pas survivre a un relevement.
      return <div key={generation} className="garde-arbre">{this.props.children}</div>;
    }

    return (
      <div className="panne">
        <div className="panne__boite">
          <h1 className="panne__titre">Quelque chose s'est casse</h1>
          <p className="panne__mot">
            L'affichage s'est interrompu, et n'a pas su repartir seul. Vos notes et vos
            positions sont sur le disque, intactes : rien de ce que vous avez ecrit n'est
            perdu.
          </p>
          <pre className="panne__detail">
            {panne.message}
            {ou ? `\n${ou}` : ""}
          </pre>
          <div className="panne__actions">
            <button type="button" className="panne__reprendre" onClick={this.reprendre}>
              Reprendre
            </button>
            <button
              type="button"
              className="panne__recharger"
              onClick={() => window.location.reload()}
            >
              Recharger l'application
            </button>
          </div>
        </div>
      </div>
    );
  }
}
