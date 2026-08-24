/** Une note : un fichier markdown, avec ses images accrochees autour. */

import { api } from "../lib/api";
import type { NoteSummary, Position } from "../lib/types";
import { useDraggable } from "./useDraggable";

interface Props {
  note: NoteSummary;
  scale: number;
  active: boolean;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onOpen: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function NoteNode({
  note,
  scale,
  active,
  onMove,
  onCommit,
  onOpen,
  onContextMenu,
}: Props) {
  const { dragging, handlers } = useDraggable({
    position: note.position,
    scale,
    onMove,
    onCommit,
    onClick: onOpen,
  });

  return (
    <div
      className={`node note${dragging ? " is-dragging" : ""}${active ? " is-active" : ""}`}
      style={{ transform: `translate(${note.position.x}px, ${note.position.y}px)` }}
      onContextMenu={onContextMenu}
      {...handlers}
    >
      {/* Images accrochees, chacune reliee a la note par un fil. */}
      {note.images.map((image, index) => (
        <div
          key={`${image.path}-${index}`}
          className="note__pinned"
          style={{
            transform: `translate(${image.position.x}px, ${image.position.y}px)`,
          }}
        >
          <svg className="note__thread" aria-hidden="true">
            <line
              x1={-image.position.x}
              y1={-image.position.y}
              x2={0}
              y2={0}
              stroke="currentColor"
            />
          </svg>
          <img src={api.fileUrl(image.path)} alt={image.caption} draggable={false} />
        </div>
      ))}

      <div className="note__card">
        <div className="note__body">{note.excerpt || "Note vide"}</div>
        {note.tags.length > 0 && (
          <div className="note__tags">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="node__label">
        <span className="node__title">{note.title}</span>
      </div>
    </div>
  );
}
