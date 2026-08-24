/** Panneau d'edition d'une note : source markdown, ou apercu rendu. */

import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { api } from "../lib/api";
import type { Note } from "../lib/types";
import { mentaliisTheme } from "./theme";

const AUTOSAVE_DELAY = 700;

interface Props {
  noteId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "ecriture" | "apercu";

export function NoteEditor({ noteId, onClose, onSaved }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<Mode>("ecriture");
  const [status, setStatus] = useState<"pret" | "modifie" | "enregistre">("pret");
  const [error, setError] = useState<string | null>(null);

  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const content = useRef<string>("");
  const timer = useRef<number | null>(null);

  const md = useMemo(
    () => new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true }),
    [],
  );

  // Charge la note demandee.
  useEffect(() => {
    let cancelled = false;
    setNote(null);
    setError(null);
    api
      .note(noteId)
      .then((loaded) => {
        if (!cancelled) {
          setNote(loaded);
          content.current = loaded.content;
          setStatus("pret");
        }
      })
      .catch((problem: Error) => !cancelled && setError(problem.message));
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Monte CodeMirror une fois la note chargee et le mode ecriture actif.
  useEffect(() => {
    if (!note || mode !== "ecriture" || !host.current) return;

    const save = (text: string) => {
      content.current = text;
      setStatus("modifie");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        try {
          await api.saveNote(noteId, text);
          setStatus("enregistre");
          onSaved();
        } catch (problem) {
          setError((problem as Error).message);
        }
      }, AUTOSAVE_DELAY);
    };

    const editor = new EditorView({
      state: EditorState.create({
        doc: content.current,
        extensions: [
          history(),
          drawSelection(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          // Sans `codeLanguages` : la coloration de chaque langage ne serait pas
          // chargee a la demande, elle pese 700 ko a elle seule.
          markdown(),
          EditorView.lineWrapping,
          mentaliisTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) save(update.state.doc.toString());
          }),
        ],
      }),
      parent: host.current,
    });
    view.current = editor;
    editor.focus();

    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [mode, note, noteId, onSaved]);

  // Enregistre immediatement ce qui reste en attente avant de fermer.
  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void api.saveNote(noteId, content.current).catch(() => undefined);
      }
    };
  }, [noteId]);

  if (error) {
    return (
      <aside className="editor">
        <div className="editor__error">{error}</div>
      </aside>
    );
  }

  if (!note) {
    return (
      <aside className="editor">
        <div className="editor__loading">Ouverture…</div>
      </aside>
    );
  }

  return (
    <aside className="editor">
      <header className="editor__head">
        <div className="editor__identity">
          <h2>{note.title}</h2>
          <span className="editor__path">{note.id}</span>
        </div>
        <div className="editor__actions">
          <button
            type="button"
            className={mode === "ecriture" ? "is-active" : ""}
            onClick={() => setMode("ecriture")}
          >
            Ecrire
          </button>
          <button
            type="button"
            className={mode === "apercu" ? "is-active" : ""}
            onClick={() => setMode("apercu")}
          >
            Apercu
          </button>
          <button type="button" className="editor__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </div>
      </header>

      {mode === "ecriture" ? (
        <div ref={host} className="editor__surface" />
      ) : (
        <div
          className="editor__surface markdown-body"
          dangerouslySetInnerHTML={{ __html: md.render(content.current) }}
        />
      )}

      <footer className="editor__status">
        {status === "modifie" && "Enregistrement…"}
        {status === "enregistre" && "Enregistre"}
        {status === "pret" && `${note.tags.length} tag${note.tags.length > 1 ? "s" : ""}`}
      </footer>
    </aside>
  );
}
