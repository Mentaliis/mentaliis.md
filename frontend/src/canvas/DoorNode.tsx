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
  onStartLink: (event: React.PointerEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

/** Ce que valent les trois tailles, rapportees a l'echelle d'une porte. */
const ECHELLES: Record<number, number> = { 1: 1, 2: 1.25, 3: 2 };

export function DoorNode({
  door,
  scale,
  onMove,
  onCommit,
  onEnter,
  onChanged,
  onError,
  onStartLink,
  onContextMenu,
}: Props) {
  const { dragging, handlers } = useDraggable({
    position: door.position,
    scale,
    onMove,
    onCommit,
    onClick: onEnter,
  });

  // Deposer une image sur une porte, c'est lui donner sa vision. Elle est rangee
  // dans le dossier des medias, puisque c'est de la que doit venir toute vision.
  const drop = useImageDrop({
    single: true,
    onError,
    onFiles: async ([file]) => {
      const { folder, exists } = await api.media();
      if (!exists) {
        onError(`Creez d'abord le dossier ${folder} a la racine du Vault.`);
        return;
      }
      await api.setCover(door.id, await api.importFile(file, folder));
      onChanged();
    },
  });

  return (
    <div
      data-node-id={door.id}
      className={`node door door--${door.icon === "cerveau" ? "cerveau" : door.icon === "porte" ? "porte" : "icone"}${dragging ? " is-dragging" : ""}${drop.over ? " is-drop-target" : ""}`}
      style={
        {
          transform: `translate(${door.position.x}px, ${door.position.y}px)`,
          // Trois echelles au choix pour l'icone : celle de la porte, un quart
          // de plus, ou le double. Une seule valeur, que les trois apparences
          // — porte, cerveau, icone apportee — suivent chacune a sa maniere.
          "--icone-echelle": ECHELLES[door.icon_size] ?? 1,
        } as React.CSSProperties
      }
      onContextMenu={onContextMenu}
      onDoubleClick={onEnter}
      {...handlers}
      {...drop.handlers}
    >

      {/* La poignee d'ou part un trait vers un autre element. */}
      <span
        className="node__plug"
        title="Tirer vers un autre element pour les relier"
        onPointerDown={onStartLink}
      />

      {/* Une porte sans vision ne montre pas de cadre vide : un rectangle gris
          marque « vision » n'apprend rien et encombre l'espace. Le cadre
          reapparait le temps qu'une image survole la porte, pour dire ou la
          lacher. */}
      {door.cover ? (
        <div className="door__vision">
          <img src={api.fileUrl(door.cover)} alt="" draggable={false} />
        </div>
      ) : drop.over ? (
        <div className="door__vision">
          <div className="door__vision-empty">lacher ici</div>
        </div>
      ) : null}

      {door.icon === "cerveau" ? (
        <BrainIcon id={door.id} />
      ) : door.icon === "porte" ? (
        <div className="door__frame">
          <div className="door__panel" />
          <div className="door__handle" />
        </div>
      ) : (
        /* Une icone apportee par l'utilisateur : quelle que soit sa forme, elle
           est encapsulee dans l'encombrement d'une porte, sans deformation. */
        <div className="door__badge">
          <img src={api.fileUrl(door.icon)} alt="" draggable={false} />
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
