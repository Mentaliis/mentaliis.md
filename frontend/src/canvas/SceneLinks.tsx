/**
 * Les traits tires a la main entre les elements d'une scene.
 *
 * Ils ne disent rien du contenu des notes — pour cela il y a les [[wikilinks]] —
 * mais ce que l'on decide soi-meme : « ceci depend de cela », « ces deux portes
 * vont ensemble ». On les attache en tirant depuis la poignee d'un element, on
 * les detache en cliquant la croix qui apparait au survol du trait.
 */

import { useState } from "react";
import type { Position, SceneLink } from "../lib/types";

/** Ou un trait s'accroche sur un element : son centre. */
export interface Anchor {
  x: number;
  y: number;
}

interface Props {
  links: SceneLink[];
  /** Centre de chaque element, en coordonnees du monde. */
  anchors: Map<string, Anchor>;
  /** Trait en cours de trace, quand on tire depuis une poignee. */
  pending: { from: string; to: Position } | null;
  /** Echelle courante, pour garder croix et traits lisibles a tout zoom. */
  scale: number;
  onDetach: (link: SceneLink) => void;
}

export function SceneLinks({ links, anchors, pending, scale, onDetach }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const depart = pending ? anchors.get(pending.from) : undefined;

  return (
    <svg className="links-layer" aria-hidden="true">
      {links.map((link) => {
        const a = anchors.get(link.source);
        const b = anchors.get(link.target);
        if (!a || !b) return null;

        const key = `${link.source}|${link.target}`;
        const actif = hovered === key;
        const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        return (
          <g
            key={key}
            className={`link${actif ? " is-hovered" : ""}`}
            onPointerEnter={() => setHovered(key)}
            onPointerLeave={() => setHovered(null)}
          >
            {/* Un trait fin se vise mal : une bande large et invisible le double. */}
            <line
              className="link__hit"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={18 / scale}
            />
            <line className="link__line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />

            {actif && (
              <g
                className="link__detach"
                transform={`translate(${milieu.x} ${milieu.y}) scale(${1 / scale})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onDetach(link);
                }}
              >
                <circle r="11" />
                <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
              </g>
            )}
          </g>
        );
      })}

      {/* Le trait que l'on est en train de tirer. */}
      {pending && depart && (
        <line
          className="link__pending"
          x1={depart.x}
          y1={depart.y}
          x2={pending.to.x}
          y2={pending.to.y}
        />
      )}
    </svg>
  );
}
