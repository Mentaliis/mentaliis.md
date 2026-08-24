/**
 * L'ecriture d'une note.
 *
 * Deux modes seulement : **ecriture**, ou le markdown se met en forme au fur et
 * a mesure qu'on le tape, et **lecture**, qui verrouille le texte sans rien
 * changer a son apparence. Les deux affichent exactement la meme chose : c'est
 * le meme moteur de rendu, seul le clavier change.
 */

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialog } from "../components/Dialog";
import { api } from "../lib/api";
import type { Note, NoteLinks } from "../lib/types";
import { InsertMenu } from "./InsertMenu";
import type { Insertion } from "./insertions";
import { livePreview } from "./livePreview";
import { mentaliisTheme } from "./theme";

const AUTOSAVE_DELAY = 600;

export type Mode = "ecriture" | "lecture";

interface Props {
  noteId: string;
  /** Increment a chaque changement externe : force le rechargement depuis le disque. */
  reloadToken?: number;
  onSaved: () => void;
  onOpenNote: (id: string) => void;
}

export function NoteEditor({ noteId, reloadToken, onSaved, onOpenNote }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  /** Titre lu dans le texte en cours : il change des qu'on modifie le premier titre. */
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const [links, setLinks] = useState<NoteLinks | null>(null);
  const [mode, setMode] = useState<Mode>("ecriture");
  const [status, setStatus] = useState<"pret" | "modifie" | "enregistre">("pret");
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const dialog = useDialog();

  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const content = useRef("");
  const timer = useRef<number | null>(null);
  /** Position du curseur, conservee d'une reconstruction de l'editeur a l'autre. */
  const caret = useRef(0);

  const refreshLinks = useCallback(() => {
    api
      .links(noteId)
      .then(setLinks)
      .catch(() => setLinks(null));
  }, [noteId]);

  /** Ouvre la note visee par un [[lien]], ou propose de la creer. */
  const followLink = useCallback(
    async (target: string) => {
      try {
        const { id } = await api.resolveLink(target);
        if (id) {
          onOpenNote(id);
          return;
        }
        const create = await dialog.confirm({
          title: `Creer « ${target} » ?`,
          message: "Cette note n'existe pas encore. Elle sera creee dans la porte courante.",
          confirmLabel: "Creer la note",
        });
        if (create) {
          const created = await api.createNote(note?.parent ?? "", target);
          onSaved();
          onOpenNote(created.id);
        }
      } catch (problem) {
        setError((problem as Error).message);
      }
    },
    [dialog, note?.parent, onOpenNote, onSaved],
  );

  // --- Chargement de la note ---

  useEffect(() => {
    let cancelled = false;
    api
      .note(noteId)
      .then((loaded) => {
        if (cancelled) return;
        setNote(loaded);
        content.current = loaded.content;
        setLiveTitle(headingOf(loaded.content));
        setStatus("pret");
        setError(null);
      })
      .catch((problem: Error) => !cancelled && setError(problem.message));
    refreshLinks();
    return () => {
      cancelled = true;
    };
  }, [noteId, reloadToken, refreshLinks]);

  // --- Montage de l'editeur ---

  const loaded = note !== null;
  const readOnly = mode === "lecture";

  // Ces fonctions changent d'identite a chaque rendu du parent. Les lire dans une
  // reference plutot que dans les dependances evite de reconstruire l'editeur pour
  // rien : le reconstruire ramenait le curseur au debut du texte a chaque
  // enregistrement automatique.
  const latest = useRef({ onSaved, refreshLinks, followLink });
  latest.current = { onSaved, refreshLinks, followLink };

  useEffect(() => {
    if (!loaded || !host.current) return;

    const save = (text: string) => {
      content.current = text;
      setLiveTitle(headingOf(text));
      setStatus("modifie");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        try {
          await api.saveNote(noteId, text);
          setStatus("enregistre");
          latest.current.onSaved();
          latest.current.refreshLinks();
        } catch (problem) {
          setError((problem as Error).message);
        }
      }, AUTOSAVE_DELAY);
    };

    const extensions: Extension[] = [
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      // `markdownLanguage` en base : c'est lui qui apporte les tableaux,
      // les cases a cocher et le texte barre.
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      mentaliisTheme,
      // En lecture, la syntaxe ne se devoile jamais : la note reste consultative.
      livePreview((target) => void latest.current.followLink(target), !readOnly),
      placeholder("Ecrivez ici. Tapez « # » pour un titre, « - [ ] » pour une case."),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    } else {
      // Pas de surlignage de ligne active : sur un titre, la bande grise
      // ecrase la mise en forme au lieu de l'aider.
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) save(update.state.doc.toString());
          if (update.selectionSet) caret.current = update.state.selection.main.head;
        }),
      );
    }

    // On revient ou l'on etait : bascule ecriture/lecture ou relecture du disque
    // ne doivent pas faire perdre sa place dans le texte.
    const anchor = Math.min(caret.current, content.current.length);

    const editor = new EditorView({
      state: EditorState.create({ doc: content.current, extensions, selection: { anchor } }),
      parent: host.current,
    });
    view.current = editor;
    if (!readOnly) editor.focus();

    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [loaded, noteId, readOnly, reloadToken]);

  // Ctrl+E bascule entre ecrire et lire, sans quitter la note.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setMode((current) => (current === "ecriture" ? "lecture" : "ecriture"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Enregistre ce qui reste en attente avant de quitter la note.
  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void api.saveNote(noteId, content.current).catch(() => undefined);
      }
    };
  }, [noteId]);

  // --- Insertions ---

  /** Insere un fragment ; le « | » du modele indique ou laisser le curseur. */
  const insert = useCallback((snippet: string, block = false) => {
    const editor = view.current;
    if (!editor) return;

    const range = editor.state.selection.main;
    const line = editor.state.doc.lineAt(range.from);
    // Un bloc commence toujours sur sa propre ligne.
    const prefix = block && line.text.trim() !== "" ? "\n" : "";

    const caret = snippet.indexOf("|");
    const text = prefix + snippet.replace("|", "");
    const at = range.from + prefix.length + (caret === -1 ? text.length - prefix.length : caret);

    editor.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection: { anchor: at },
      scrollIntoView: true,
    });
    editor.focus();
  }, []);

  /** Insere un symbole, en ouvrant une formule si le curseur n'est pas deja dedans. */
  const insertSymbol = useCallback(
    (latex: string) => {
      const editor = view.current;
      if (!editor) return;
      const range = editor.state.selection.main;
      const line = editor.state.doc.lineAt(range.from);
      const before = line.text.slice(0, range.from - line.from);
      // Un nombre impair de « $ » avant le curseur signifie qu'une formule est ouverte.
      const insideFormula = (before.match(/\$/g)?.length ?? 0) % 2 === 1;
      insert(insideFormula ? `${latex} |` : `$${latex} |$`);
    },
    [insert],
  );

  const insertImage = useCallback((path: string) => insert(`![[${path}]]\n|`, true), [insert]);

  const upload = useCallback(
    async (file: File) => {
      try {
        insertImage(await api.importFile(file));
      } catch (problem) {
        setError((problem as Error).message);
      }
    },
    [insertImage],
  );

  // Deposer une image directement dans le texte l'insere a cet endroit.
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      for (const file of files) await upload(file);
    },
    [upload],
  );

  if (error && !note) {
    return <div className="editor__error">{error}</div>;
  }

  if (!note) {
    return <div className="editor__loading">Ouverture…</div>;
  }

  const neighbours =
    (links?.backlinks.length ?? 0) + (links?.outgoing.length ?? 0) + (links?.unresolved.length ?? 0);

  return (
    <section className="editor">
      <header className="editor__head">
        <div className="editor__identity">
          <h2>{liveTitle || note.title}</h2>
          <span className="editor__path">{note.id}</span>
        </div>

        <div className="editor__actions">
          {mode === "ecriture" && (
            <div className="editor__insert">
              <button
                type="button"
                className={`editor__plus${inserting ? " is-active" : ""}`}
                title="Inserer un bloc, un symbole ou une image"
                onClick={() => setInserting((open) => !open)}
              >
                +
              </button>
              {inserting && (
                <InsertMenu
                  onInsert={(item: Insertion) => insert(item.snippet, item.block)}
                  onSymbol={insertSymbol}
                  onImage={insertImage}
                  onUpload={upload}
                  onClose={() => setInserting(false)}
                />
              )}
            </div>
          )}

          <div className="editor__modes">
            <button
              type="button"
              className={mode === "ecriture" ? "is-active" : ""}
              onClick={() => setMode("ecriture")}
              title="Ecrire (Ctrl+E)"
            >
              Ecriture
            </button>
            <button
              type="button"
              className={mode === "lecture" ? "is-active" : ""}
              onClick={() => setMode("lecture")}
              title="Lire sans pouvoir modifier (Ctrl+E)"
            >
              Lecture
            </button>
          </div>
        </div>
      </header>

      <div
        ref={host}
        className={`editor__surface${readOnly ? " is-locked" : ""}`}
        onDrop={onDrop}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
      />

      {links && neighbours > 0 && (
        <section className={`links${showLinks ? "" : " is-folded"}`}>
          <button
            type="button"
            className="links__toggle"
            onClick={() => setShowLinks((open) => !open)}
          >
            {showLinks ? "▾" : "▸"} Voisinage · {neighbours}
          </button>

          {showLinks && (
            <div className="links__groups">
              <LinkGroup
                title="Cite par"
                items={links.backlinks.map((ref) => ({ key: ref.id, label: ref.title }))}
                onPick={(key) => onOpenNote(key)}
              />
              <LinkGroup
                title="Cite"
                items={links.outgoing.map((ref) => ({ key: ref.id, label: ref.title }))}
                onPick={(key) => onOpenNote(key)}
              />
              <LinkGroup
                title="A ecrire"
                missing
                items={links.unresolved.map((target) => ({ key: target, label: target }))}
                onPick={(key) => void followLink(key)}
              />
            </div>
          )}
        </section>
      )}

      <footer className="editor__status">
        <span>
          {error && <span className="editor__status-error">{error}</span>}
          {!error && status === "modifie" && "Enregistrement…"}
          {!error && status === "enregistre" && "Enregistre"}
          {!error && status === "pret" && (readOnly ? "Lecture seule" : "Pret")}
        </span>
        <span className="editor__counts">
          {countWords(content.current)} mots · {note.tags.length} tag
          {note.tags.length > 1 ? "s" : ""}
        </span>
      </footer>
    </section>
  );
}

function LinkGroup({
  title,
  items,
  missing = false,
  onPick,
}: {
  title: string;
  items: { key: string; label: string }[];
  missing?: boolean;
  onPick: (key: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="links__group">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={missing ? "is-missing" : ""}
              onClick={() => onPick(item.key)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Premier titre de la note, qui fait office de nom affiche. */
function headingOf(text: string): string | null {
  return /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? null;
}
