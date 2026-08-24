/** Une porte : un dossier du Vault, avec son image de vision au-dessus. */

import { api } from "../lib/api";
import type { Door, Position } from "../lib/types";
import { useDraggable } from "./useDraggable";

interface Props {
  door: Door;
  scale: number;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onEnter: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function DoorNode({ door, scale, onMove, onCommit, onEnter, onContextMenu }: Props) {
  const { dragging, handlers } = useDraggable({
    position: door.position,
    scale,
    onMove,
    onCommit,
    onClick: onEnter,
  });

  return (
    <div
      className={`node door${dragging ? " is-dragging" : ""}`}
      style={{ transform: `translate(${door.position.x}px, ${door.position.y}px)` }}
      onContextMenu={onContextMenu}
      onDoubleClick={onEnter}
      {...handlers}
    >
      <div className="door__vision">
        {door.cover ? (
          <img src={api.fileUrl(door.cover)} alt="" draggable={false} />
        ) : (
          <div className="door__vision-empty">vision</div>
        )}
      </div>

      <div className="door__frame">
        <div className="door__panel" />
        <div className="door__handle" />
      </div>

      <div className="node__label">
        <span className="node__title">{door.name}</span>
        <span className="node__meta">
          {door.note_count > 0 && `${door.note_count} note${door.note_count > 1 ? "s" : ""}`}
          {door.note_count > 0 && door.door_count > 0 && " · "}
          {door.door_count > 0 && `${door.door_count} porte${door.door_count > 1 ? "s" : ""}`}
          {door.note_count === 0 && door.door_count === 0 && "vide"}
        </span>
      </div>
    </div>
  );
}
