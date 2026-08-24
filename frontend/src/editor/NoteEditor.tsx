/** Panneau d'edition d'une note : source markdown, apercu rendu, et voisinage. */

import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { api } from "../lib/api";
import type { Note, NoteLinks } from "../lib/types";
import { mentaliisTheme } from "./theme";
import { wikilinks } from "./wikilinks";

const AUTOSAVE_DELAY = 700;

interface Props {
  noteId: string;
  /** Increment a chaque changement externe : force le rechargement depuis le disque. */
  reloadToken?: number;
  onClose: () => void;
  onSaved: () => void;
  onOpenNote: (id: string) => void;
}

type Mode = "ecriture" | "apercu";

export function NoteEditor({ noteId, reloadToken, onClose, onSaved, onOpenNote }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [links, setLinks] = useState<NoteLinks | null>(null);
  const [mode, setMode] = useState<Mode>("ecriture");
  const [status, setStatus] = useState<"pret" | "modifie" | "enregistre">("pret");
  const [error, setError] = useState<string | null>(null);

  const host = useRef<HTMLDivElement>(null);
  const content = useRef<string>("");
  const timer = useRef<number | null>(null);

  const md = useMemo(
    () =>
      new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true }).use(
        wikilinks,
      ),
    [],
  );

  const refreshLinks = useCallback(() => {
    api
      .links(noteId)
      .then(setLinks)
      .catch(() => setLinks(null));
  }, [noteId]);

  // Charge la note demandee, et la recharge si le disque a change sous nos pieds.
  useEffect(() => {
    let cancelled = false;
    api
      .note(noteId)
      .then((loaded) => {
        if (cancelled) return;
        setNote(loaded);
        content.current = loaded.content;
        setStatus("pret");
        setError(null);
      })
      .catch((problem: Error) => !cancelled && setError(problem.message));
    refreshLinks();
    return () => {
      cancelled = true;
    };
  }, [noteId, reloadToken, refreshLinks]);

  // Monte CodeMirror une fois la note chargee et le mode ecriture actif.
  // `reloadToken` fait partie des dependances : un changement externe doit
  // reconstruire l'editeur sur le nouveau contenu, pas garder l'ancien.
  const loaded = note !== null;
  useEffect(() => {
    if (!loaded || mode !== "ecriture" || !host.current) return;

    const save = (text: string) => {
      content.current = text;
      setStatus("modifie");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        try {
          await api.saveNote(noteId, text);
          setStatus("enregistre");
          onSaved();
          refreshLinks();
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
    editor.focus();

    return () => editor.destroy();
  }, [loaded, mode, noteId, reloadToken, onSaved, refreshLinks]);

  // Enregistre immediatement ce qui reste en attente avant de fermer.
  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void api.saveNote(noteId, content.current).catch(() => undefined);
      }
    };
  }, [noteId]);

  /** Ouvre la note visee par un [[wikilink]], ou la cree si elle n'existe pas. */
  const followLink = useCallback(
    async (target: string) => {
      try {
        const { id } = await api.resolveLink(target);
        if (id) {
          onOpenNote(id);
          return;
        }
        if (window.confirm(`"${target}" n'existe pas encore. La creer ?`)) {
          const created = await api.createNote(note?.parent ?? "", target);
          onSaved();
          onOpenNote(created.id);
        }
      } catch (problem) {
        setError((problem as Error).message);
      }
    },
    [note?.parent, onOpenNote, onSaved],
  );

  const onPreviewClick = (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest<HTMLElement>(".wikilink");
    if (!anchor) return;
    event.preventDefault();
    void followLink(anchor.dataset.target ?? "");
  };

  if (error && !note) {
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

  const neighbours = (links?.backlinks.length ?? 0) + (links?.outgoing.length ?? 0);

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
          onClick={onPreviewClick}
          dangerouslySetInnerHTML={{ __html: md.render(content.current) }}
        />
      )}

      {links && neighbours + links.unresolved.length > 0 && (
        <section className="links">
          {links.backlinks.length > 0 && (
            <div className="links__group">
              <h3>Cite par</h3>
              <ul>
                {links.backlinks.map((ref) => (
                  <li key={ref.id}>
                    <button type="button" onClick={() => onOpenNote(ref.id)}>
                      {ref.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {links.outgoing.length > 0 && (
            <div className="links__group">
              <h3>Cite</h3>
              <ul>
                {links.outgoing.map((ref) => (
                  <li key={ref.id}>
                    <button type="button" onClick={() => onOpenNote(ref.id)}>
                      {ref.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {links.unresolved.length > 0 && (
            <div className="links__group">
              <h3>A ecrire</h3>
              <ul>
                {links.unresolved.map((target) => (
                  <li key={target}>
                    <button
                      type="button"
                      className="is-missing"
                      onClick={() => void followLink(target)}
                    >
                      {target}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="editor__status">
        {error && <span className="editor__status-error">{error}</span>}
        {!error && status === "modifie" && "Enregistrement…"}
        {!error && status === "enregistre" && "Enregistre"}
        {!error &&
          status === "pret" &&
          `${note.tags.length} tag${note.tags.length > 1 ? "s" : ""}`}
      </footer>
    </aside>
  );
}
