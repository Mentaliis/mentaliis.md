/** Une note : un fichier markdown, avec ses images accrochees autour. */

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "../components/Dialog";
import { api } from "../lib/api";
import type { AttachedImage, NoteSummary, Position } from "../lib/types";
import { useDraggable } from "./useDraggable";
import { useImageDrop } from "./useImageDrop";

interface Props {
  note: NoteSummary;
  scale: number;
  active: boolean;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onOpen: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onStartLink: (event: React.PointerEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

/** Ou se poserait une image lachee, relativement au centre de la note. */
function dropOffset(event: React.DragEvent, scale: number): Position {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return {
    x: Math.round((event.clientX - (box.left + box.width / 2)) / scale),
    y: Math.round((event.clientY - (box.top + box.height / 2)) / scale),
  };
}

export function NoteNode({
  note,
  scale,
  active,
  onMove,
  onCommit,
  onOpen,
  onChanged,
  onError,
  onStartLink,
  onContextMenu,
}: Props) {
  // Les images bougent souvent : on les tient localement pour que le geste
  // reste fluide, et on ne previent le moteur qu'au relachement.
  const [images, setImages] = useState<AttachedImage[] | null>(null);
  const shown = images ?? note.images;

  // Des que le moteur renvoie la note, c'est lui qui fait foi a nouveau.
  useEffect(() => setImages(null), [note.images]);

  const { dragging, handlers } = useDraggable({
    position: note.position,
    scale,
    onMove,
    onCommit,
    onClick: onOpen,
  });

  const persist = useCallback(
    async (next: AttachedImage[]) => {
      setImages(next);
      try {
        await api.setImages(note.id, next);
        onChanged();
      } catch (problem) {
        setImages(null); // revient a l'etat du moteur
        onError((problem as Error).message);
      }
    },
    [note.id, onChanged, onError],
  );

  // Deposer une image sur une note, c'est l'accrocher autour.
  const drop = useImageDrop({
    onError,
    // L'image est rangee dans la reserve, d'ou doit venir toute image du Vault.
    onFiles: async (files, event) => {
      const { folder, exists } = await api.media();
      if (!exists) {
        onError(`Creez d'abord le dossier ${folder} a la racine du Vault.`);
        return;
      }
      const origin = dropOffset(event, scale);
      const paths = await Promise.all(files.map((file) => api.importFile(file, folder)));
      await persist([
        ...shown,
        ...paths.map((path, index) => ({
          path,
          caption: "",
          // Decale chaque image d'une salve pour qu'aucune n'en cache une autre.
          position: { x: origin.x + index * 24, y: origin.y + index * 18 },
        })),
      ]);
    },
  });

  return (
    <div
      data-node-id={note.id}
      className={`node note${dragging ? " is-dragging" : ""}${active ? " is-active" : ""}${
        drop.over ? " is-drop-target" : ""
      }`}
      style={{ transform: `translate(${note.position.x}px, ${note.position.y}px)` }}
      onContextMenu={onContextMenu}
      {...handlers}
      {...drop.handlers}
    >

      {/* La poignee d'ou part un trait vers un autre element. */}
      <span
        className="node__plug"
        title="Tirer vers un autre element pour les relier"
        onPointerDown={onStartLink}
      />

      {shown.map((image, index) => (
        <PinnedImage
          key={`${image.path}-${index}`}
          image={image}
          scale={scale}
          onMove={(position) =>
            setImages(shown.map((item, at) => (at === index ? { ...item, position } : item)))
          }
          onCommit={(position) =>
            void persist(
              shown.map((item, at) => (at === index ? { ...item, position } : item)),
            )
          }
          onDetach={() => void persist(shown.filter((_, at) => at !== index))}
        />
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

/** Une image accrochee a la note, reliee par un fil, deplacable a la main. */
function PinnedImage({
  image,
  scale,
  onMove,
  onCommit,
  onDetach,
}: {
  image: AttachedImage;
  scale: number;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  onDetach: () => void;
}) {
  const dialog = useDialog();
  const { dragging, handlers } = useDraggable({ position: image.position, scale, onMove, onCommit });

  return (
    <div
      className={`note__pinned${dragging ? " is-dragging" : ""}`}
      style={{ transform: `translate(${image.position.x}px, ${image.position.y}px)` }}
      title={image.caption || image.path}
      {...handlers}
      onContextMenu={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const detach = await dialog.confirm({
          title: "Detacher cette image ?",
          message: `Elle disparait de la note, mais le fichier reste dans le Vault (${image.path}).`,
          confirmLabel: "Detacher",
          danger: true,
        });
        if (detach) onDetach();
      }}
    >
      {/* Le fil part du centre de la note et rejoint l'image. */}
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
  );
}
