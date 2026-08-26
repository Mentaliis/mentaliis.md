/**
 * Une image posee dans une scene, a cote des portes et des notes.
 *
 * Elle n'est pas un fichier : c'est un renvoi vers un media de la reserve, place
 * ou l'on veut. Elle se deplace, se relie, et se regarde en trois tailles — la
 * premiere a l'echelle du cerveau, les deux autres pour vraiment voir.
 */

import type { Position, SceneImage } from "../lib/types";
import { api } from "../lib/api";
import { useDraggable } from "./useDraggable";

interface Props {
  image: SceneImage;
  scale: number;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onStartLink: (event: React.PointerEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function ImageNode({ image, scale, onMove, onCommit, onStartLink, onContextMenu }: Props) {
  const { dragging, handlers } = useDraggable({ position: image.position, scale, onMove, onCommit });

  return (
    <div
      data-node-id={image.id}
      className={`node visuel visuel--${image.size}${dragging ? " is-dragging" : ""}`}
      style={{ transform: `translate(${image.position.x}px, ${image.position.y}px)` }}
      onContextMenu={onContextMenu}
      {...handlers}
    >
      <span
        className="node__plug"
        title="Tirer vers un autre element pour les relier"
        onPointerDown={onStartLink}
      />

      <div className="visuel__cadre">
        <img src={api.fileUrl(image.path)} alt={image.caption} draggable={false} />
      </div>

      {image.caption && (
        <div className="node__label">
          <span className="node__title">{image.caption}</span>
        </div>
      )}
    </div>
  );
}
