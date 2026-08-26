/** Une porte : un dossier du Vault, avec son image de vision au-dessus. */

import { BrainIcon } from "./BrainIcon";
import { api } from "../lib/api";
import type { Door, Position } from "../lib/types";
import { useDraggable } from "./useDraggable";
import { useImageDrop } from "./useImageDrop";

interface Props {
  door: Door;
  scale: number;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onEnter: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function DoorNode({
  door,
  scale,
  onMove,
  onCommit,
  onEnter,
  onChanged,
  onError,
  onContextMenu,
}: Props) {
  const { dragging, handlers } = useDraggable({
    position: door.position,
    scale,
    onMove,
    onCommit,
    onClick: onEnter,
  });

  // Deposer une image sur une porte, c'est lui donner sa vision.
  const drop = useImageDrop({
    single: true,
    onError,
    onDropped: async ([path]) => {
      await api.setCover(door.id, path);
      onChanged();
    },
  });

  return (
    <div
      className={`node door door--${door.icon}${dragging ? " is-dragging" : ""}${drop.over ? " is-drop-target" : ""}`}
      style={{ transform: `translate(${door.position.x}px, ${door.position.y}px)` }}
      onContextMenu={onContextMenu}
      onDoubleClick={onEnter}
      {...handlers}
      {...drop.handlers}
    >
      <div className="door__vision">
        {door.cover ? (
          <img src={api.fileUrl(door.cover)} alt="" draggable={false} />
        ) : (
          <div className="door__vision-empty">{drop.over ? "lacher ici" : "vision"}</div>
        )}
      </div>

      {door.icon === "cerveau" ? (
        <BrainIcon id={door.id} />
      ) : (
        <div className="door__frame">
          <div className="door__panel" />
          <div className="door__handle" />
        </div>
      )}

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
