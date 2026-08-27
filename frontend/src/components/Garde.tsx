/**
 * Le garde-fou de l'interface.
 *
 * Sans lui, la moindre erreur pendant un rendu decroche tout l'arbre React :
 * l'ecran devient noir, sans un mot, et rien n'indique ce qui s'est passe ni
 * comment revenir. Ici, on montre au moins ce qui a echoue, et on propose de
 * repartir sans perdre le Vault ouvert.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  panne: Error | null;
  ou: string;
}

export class Garde extends Component<Props, State> {
  state: State = { panne: null, ou: "" };

  static getDerivedStateFromError(panne: Error): Partial<State> {
    return { panne };
  }

  componentDidCatch(panne: Error, info: ErrorInfo) {
    this.setState({ ou: (info.componentStack ?? "").split("\n").slice(1, 4).join("\n") });
    // Les suites de verification lisent cette liste : une panne ne doit jamais
    // passer inapercue, meme quand l'ecran, lui, se rattrape.
    const registre = (window as { __jsErrors?: string[] }).__jsErrors ?? [];
    registre.push(`rendu : ${panne.message}`);
    (window as { __jsErrors?: string[] }).__jsErrors = registre;
  }

  render() {
    const { panne, ou } = this.state;
    if (!panne) return this.props.children;

    return (
      <div className="panne">
        <div className="panne__boite">
          <h1 className="panne__titre">Quelque chose s'est casse</h1>
          <p className="panne__mot">
            L'affichage s'est interrompu. Vos notes et vos positions sont sur le disque,
            intactes : rien de ce que vous avez ecrit n'est perdu.
          </p>
          <pre className="panne__detail">
            {panne.message}
            {ou ? `\n${ou}` : ""}
          </pre>
          <div className="panne__actions">
            <button
              type="button"
              className="panne__reprendre"
              onClick={() => this.setState({ panne: null, ou: "" })}
            >
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
