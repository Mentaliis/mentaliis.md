/**
 * L'ecriture d'une note.
 *
 * Deux modes seulement : **ecriture**, ou le markdown se met en forme au fur et
 * a mesure qu'on le tape, et **lecture**, qui verrouille le texte sans rien
 * changer a son apparence. Les deux affichent exactement la meme chose : c'est
 * le meme moteur de rendu, seul le clavier change.
 */

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { colorationDuCode, langagesConnus } from "./coloration";
import { enPixelsDeMiseEnPage } from "./echelle";
import { syntaxesEtendues } from "./syntaxes";
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
import { IconePanneau } from "../components/Icones";
import { FloatingFormatMenu, type ActionDeMiseEnForme } from "./FloatingFormatMenu";
import {
  basculerEntourage,
  basculerPrefixe,
  blocCourant,
  effacerLaMiseEnForme,
  misesEnFormeActives,
  type Entourage,
  type Prefixe,
} from "./formatage";
import { LanguagePicker } from "./LanguagePicker";
import { raccourcisDeMiseEnForme } from "./raccourcis";
import { InsertMenu } from "./InsertMenu";
import type { Insertion } from "./insertions";
import { lineHandle, type HoveredLine } from "./lineHandle";
import { livePreview } from "./livePreview";
import { normaliseMarqueurs } from "./normalise";
import { mentaliisTheme } from "./theme";

const AUTOSAVE_DELAY = 600;

export type Mode = "ecriture" | "lecture";

interface Props {
  noteId: string;
  /** Increment a chaque changement externe : force le rechargement depuis le disque. */
  reloadToken?: number;
  onSaved: () => void;
  onOpenNote: (id: string) => void;
  /** Previent que la note a change d'identite, pour que son onglet suive. */
  onRenamed: (oldId: string, newId: string, title?: string) => void;
  /** Titre lu dans le texte, a repercuter sans attendre l'enregistrement. */
  onTitle: (id: string, title: string) => void;
  /** La bande de gauche est-elle repliee, et de combien faut-il compenser ? */
  railCache: boolean;
  railLargeur: number;
  onBasculerRail: () => void;
}

export function NoteEditor({
  noteId,
  reloadToken,
  onSaved,
  onOpenNote,
  onRenamed,
  onTitle,
  railCache,
  railLargeur,
  onBasculerRail,
}: Props) {
  const [note, setNote] = useState<Note | null>(null);
  /** Titre lu dans le texte en cours : il change des qu'on modifie le premier titre. */
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const [links, setLinks] = useState<NoteLinks | null>(null);
  const [mode, setMode] = useState<Mode>("ecriture");
  const [status, setStatus] = useState<"pret" | "modifie" | "enregistre">("pret");
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  /** Ligne survolee : c'est devant elle que se pose la poignee « + ». */
  const [hovered, setHovered] = useState<HoveredLine | null>(null);
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
  /**
   * La barre de mise en forme, quand du texte est selectionne.
   *
   * Elle ne s'affiche que sur une selection reelle : poser simplement le
   * curseur ne doit rien faire surgir devant le texte.
   */
  const [barre, setBarre] = useState<{
    selection: { left: number; right: number; top: number; bottom: number };
    actives: Set<Entourage>;
    bloc: Prefixe | null;
  } | null>(null);

  /** Le bloc dont on choisit le langage : ou le reecrire, et ou poser la liste. */
  const [langage, setLangage] = useState<{
    from: number;
    to: number;
    courant: string | null;
    ancre: { x: number; y: number };
  } | null>(null);

  /**
   * Ouvre le choix du langage pour un bloc de code.
   *
   * La liste se pose sous la pastille, la ou l'oeil est deja.
   */
  const choisirLangage = useCallback(
    (from: number, to: number, courant: string | null) => {
      const vue = view.current;
      const place = vue?.coordsAtPos(from);
      setLangage({
        from,
        to,
        courant,
        // Meme conversion que pour la barre : on mesure en pixels d'ecran,
        // on positionne en pixels de mise en page.
        ancre: place
          ? (() => {
              const p = enPixelsDeMiseEnPage(place);
              return { x: Math.round(p.left), y: Math.round(p.bottom + 6) };
            })()
          : { x: 200, y: 200 },
      });
    },
    [],
  );

  /**
   * Montre ou cache la barre de mise en forme selon ce qui est selectionne.
   *
   * On mesure la selection dans l'editeur plutot qu'avec l'API du navigateur :
   * CodeMirror connait ses propres positions, et cela reste juste meme quand le
   * texte defile.
   */
  const suivreLaSelection = useCallback((vue: EditorView) => {
    const { from, to } = vue.state.selection.main;
    if (from === to) {
      setBarre(null);
      return;
    }
    const debut = vue.coordsAtPos(from);
    const fin = vue.coordsAtPos(to);
    if (!debut || !fin) {
      setBarre(null);
      return;
    }
    setBarre({
      selection: {
        left: Math.min(debut.left, fin.left),
        right: Math.max(debut.right, fin.right),
        top: Math.min(debut.top, fin.top),
        bottom: Math.max(debut.bottom, fin.bottom),
      },
      actives: misesEnFormeActives(vue.state),
      bloc: blocCourant(vue.state),
    });
  }, []);

  /** Demande une adresse, puis pose un lien autour de la selection. */
  const poserUnLien = useCallback(async () => {
    const vue = view.current;
    if (!vue) return;
    const { from, to } = vue.state.selection.main;
    const texte = vue.state.sliceDoc(from, to);
    const adresse = await dialog.prompt({
      title: "Adresse du lien",
      message: texte ? `Pour « ${texte} ».` : "Le texte du lien sera l'adresse elle-meme.",
      placeholder: "https://…",
      confirmLabel: "Poser le lien",
    });
    if (!adresse) return;
    const libelleDuLien = texte || adresse;
    vue.dispatch({
      changes: { from, to, insert: `[${libelleDuLien}](${adresse})` },
      selection: { anchor: from + libelleDuLien.length + adresse.length + 4 },
    });
    vue.focus();
  }, [dialog]);

  const latest = useRef({
    onSaved,
    refreshLinks,
    followLink,
    onRenamed,
    onTitle,
    choisirLangage,
    suivreLaSelection,
    poserUnLien,
  });
  latest.current = {
    onSaved,
    refreshLinks,
    followLink,
    onRenamed,
    onTitle,
    choisirLangage,
    suivreLaSelection,
    poserUnLien,
  };

  useEffect(() => {
    if (!loaded || !host.current) return;

    const save = (text: string) => {
      content.current = text;
      const titre = headingOf(text);
      setLiveTitle(titre);
      if (titre) latest.current.onTitle(noteId, titre);
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
      // Avant le clavier par defaut : ces raccourcis doivent l'emporter.
      keymap.of(raccourcisDeMiseEnForme(() => latest.current.poserUnLien())),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      // `markdownLanguage` en base : c'est lui qui apporte les tableaux,
      // les cases a cocher et le texte barre.
      //
      // `codeLanguages` fait analyser le contenu des blocs clotures par
      // l'analyseur du langage nomme apres les accents graves. La note reste un
      // seul document : pas d'editeur imbrique par bloc, donc pas de curseur ni
      // d'annulation a reconcilier, et l'affichage par fenetre de CodeMirror
      // vaut pour l'ensemble.
      markdown({
        base: markdownLanguage,
        codeLanguages: langagesConnus,
        // Surlignage, exposant, indice, emoji : ce que le guide markdown
        // appelle la syntaxe etendue, et que CommonMark ne couvre pas.
        extensions: syntaxesEtendues,
      }),
      colorationDuCode(),
      // Taper « ## » devant un titre en change le niveau, sans jamais montrer le code.
      normaliseMarqueurs(),
      EditorView.lineWrapping,
      mentaliisTheme,
      // En lecture, la syntaxe ne se devoile jamais : la note reste consultative.
      livePreview(
        (target) => void latest.current.followLink(target),
        (from, to, courant) => latest.current.choisirLangage(from, to, courant),
        !readOnly,
      ),
      placeholder("Ecrivez ici. Tapez « # » pour un titre, « - [ ] » pour une case."),
    ];

    if (!readOnly) extensions.push(lineHandle(setHovered));

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    } else {
      // Pas de surlignage de ligne active : sur un titre, la bande grise
      // ecrase la mise en forme au lieu de l'aider.
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) save(update.state.doc.toString());
          if (update.selectionSet) caret.current = update.state.selection.main.head;
          // La barre de mise en forme suit ce qui est selectionne. Poser
          // simplement le curseur ne doit rien faire surgir devant le texte :
          // il faut une vraie selection.
          if (update.selectionSet || update.docChanged || update.geometryChanged) {
            latest.current.suivreLaSelection(update.view);
          }
        }),
      );
    }

    // Une note neuve ne contient que sa ligne de titre : la lecture du fichier
    // en retire les blancs de fin. Sans ligne en dessous, le curseur resterait
    // sur le titre, qui se devoilerait au lieu de rester replie.
    const premiere = content.current.split("\n", 1)[0];
    const porteUnTitre = /^#\s/.test(premiere);
    if (porteUnTitre && !content.current.includes("\n")) {
      content.current = `${content.current}\n\n`;
    }

    // On revient ou l'on etait : bascule ecriture/lecture ou relecture du disque
    // ne doivent pas faire perdre sa place dans le texte. Mais jamais sur la
    // ligne du titre : elle y est repliee.
    const plancher = porteUnTitre ? premiere.length + 1 : 0;
    const anchor = Math.min(Math.max(caret.current, plancher), content.current.length);

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

  /**
   * Renomme la note.
   *
   * Passer par un geste explicite plutot que par un champ toujours modifiable :
   * un titre ne doit pas changer parce qu'on a clique au mauvais endroit.
   */
  const rename = useCallback(async () => {
    if (!note) return;
    const voulu = await dialog.prompt({
      title: "Renommer la note",
      value: note.title,
      confirmLabel: "Renommer",
    });
    if (!voulu || voulu === note.title) return;
    try {
      // Le titre vit a trois endroits : le frontmatter, le `# titre` en tete, et
      // le nom du fichier. Le moteur les met d'accord d'un seul geste.
      const renommee = await api.retitle(note.id, voulu);
      latest.current.onRenamed(note.id, renommee.id, renommee.title);
      latest.current.onSaved();
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [dialog, note, onOpenNote]);

  // Ctrl+Maj+L bascule entre ecrire et lire, sans quitter la note.
  //
  // Ce raccourci occupait Ctrl+E, que tous les editeurs reservent au code en
  // ligne. Il a donc cede la place, et pris le L de « lecture ».
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
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

  /**
   * Insere devant une ligne precise — celle que porte la poignee « + ».
   *
   * Une ligne deja ecrite garde son texte : le bloc vient se poser juste apres.
   * Une ligne vide accueille le bloc a sa place.
   */
  const insertAt = useCallback(
    (lineFrom: number | undefined, snippet: string, block = false) => {
      const editor = view.current;
      if (!editor) return;
      if (lineFrom === undefined) return insert(snippet, block);

      const line = editor.state.doc.lineAt(Math.min(lineFrom, editor.state.doc.length));
      const vide = line.text.trim() === "";
      const debut = vide ? line.from : line.to;
      const prefix = vide ? "" : "\n";

      const caret = snippet.indexOf("|");
      const texte = prefix + snippet.replace("|", "");
      const at = debut + prefix.length + (caret === -1 ? texte.length - prefix.length : caret);

      editor.dispatch({
        changes: { from: debut, to: vide ? line.to : debut, insert: texte },
        selection: { anchor: at },
        scrollIntoView: true,
      });
      editor.focus();
    },
    [insert],
  );

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
    <section
      className="editor"
      style={
        {
          // Bande repliee, la colonne d'ecriture ne bouge pas d'un pixel : elle
          // reprend a son compte la largeur que la bande occupait. Sans cela,
          // le titre irait se coller au bord de la fenetre, ce qui est
          // precisement ce qu'on cherchait a eviter en le rapprochant.
          "--rail-compense": railCache ? `${railLargeur}px` : "0px",
        } as React.CSSProperties
      }
    >
      <header className="editor__head">
        {/* Le titre ne s'affiche qu'une fois, et ne se modifie pas par megarde :
            il faut passer par le crayon qui apparait au survol. */}
        <div className="editor__identity">
          <h1 className="editor__title">{liveTitle || note.title}</h1>
          <button
            type="button"
            className="editor__rename"
            title="Renommer la note"
            aria-label="Renommer la note"
            onClick={() => void rename()}
          >
            ✎
          </button>
        </div>

        <div className="editor__actions">
          <button
            type="button"
            className={`editor__replier${railCache ? " is-active" : ""}`}
            onClick={onBasculerRail}
            title={
              railCache
                ? "Reafficher la liste des notes"
                : "Masquer la liste des notes, pour n'avoir que le texte"
            }
            aria-label={railCache ? "Reafficher la liste" : "Masquer la liste"}
            aria-pressed={railCache}
          >
            <IconePanneau ouvert={!railCache} />
          </button>
          <div className="editor__modes">
            <button
              type="button"
              className={mode === "ecriture" ? "is-active" : ""}
              onClick={() => setMode("ecriture")}
              title="Ecrire (Ctrl+Maj+L)"
            >
              Ecriture
            </button>
            <button
              type="button"
              className={mode === "lecture" ? "is-active" : ""}
              onClick={() => setMode("lecture")}
              title="Lire sans pouvoir modifier (Ctrl+Maj+L)"
            >
              Lecture
            </button>
          </div>
        </div>
      </header>

      <div
        className="editor__stage"
        onDrop={onDrop}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
      >
        <div ref={host} className={`editor__surface${readOnly ? " is-locked" : ""}`} />

        {/* La poignee vient se poser devant la ligne survolee, et s'efface en
            fondu des qu'on la quitte. */}
        {!readOnly && (hovered || inserting) && (
          <div
            className="editor__handle"
            // Centree sur le texte de la ligne, quelle que soit sa taille.
            style={{ top: (hovered?.top ?? 0) + (hovered?.height ?? 0) / 2 }}
            onPointerDown={(event) => event.preventDefault()}
          >
            <button
              type="button"
              className={`editor__plus${inserting ? " is-active" : ""}`}
              title="Inserer un bloc, un media, un symbole"
              aria-label="Inserer"
              onClick={() => setInserting((open) => !open)}
            >
              +
            </button>
      {inserting && (
              <InsertMenu
                onInsert={(item: Insertion) => {
                  setInserting(false);
                  insertAt(hovered?.from, item.snippet, item.block);
                }}
                onSymbol={(latex) => {
                  setInserting(false);
                  insertSymbol(latex);
                }}
                onMedia={(path) => {
                  setInserting(false);
                  insertAt(hovered?.from, `![[${path}]]`, true);
                }}
                onUpload={upload}
                onClose={() => setInserting(false)}
              />
            )}
          </div>
        )}
      </div>

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

      {barre && (
        <FloatingFormatMenu
          selection={barre.selection}
          actives={barre.actives}
          bloc={barre.bloc}
          onClose={() => setBarre(null)}
          onAction={(action: ActionDeMiseEnForme) => {
            const vue = view.current;
            if (!vue) return;
            if (action.quoi === "lien") {
              void poserUnLien();
              return;
            }
            const commande =
              action.quoi === "entourage"
                ? basculerEntourage(action.nom)
                : action.quoi === "bloc"
                  ? basculerPrefixe(action.nom)
                  : effacerLaMiseEnForme;
            commande({ state: vue.state, dispatch: (t) => vue.dispatch(t) });
            vue.focus();
            // La selection a pu bouger : la barre doit s'y recaler aussitot.
            suivreLaSelection(vue);
          }}
        />
      )}

      {langage && (
        <LanguagePicker
          courant={langage.courant}
          ancre={langage.ancre}
          onClose={() => setLangage(null)}
          onChoisir={(choix) => {
            const vue = view.current;
            const cible = langage;
            setLangage(null);
            if (!vue) return;
            // On ne reecrit que la ligne d'ouverture : le code lui-meme ne bouge
            // pas d'un caractere, et le fichier reste du markdown standard.
            const accents =
              vue.state.sliceDoc(cible.from, cible.to).match(/^\s*`{3,}/)?.[0] ?? "```";
            vue.dispatch({
              changes: {
                from: cible.from,
                to: cible.to,
                insert: choix ? `${accents}${choix.toLowerCase()}` : accents,
              },
            });
            vue.focus();
          }}
        />
      )}
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
/**
 * Le titre d'une note : le `# ` de sa toute premiere ligne.
 *
 * Un titre ecrit plus bas dans le texte est un titre de section, pas le nom de
 * la note — il ne doit pas la renommer pendant qu'on ecrit.
 */
function headingOf(text: string): string | null {
  return /^#[ 	]+(.+)/.exec(text)?.[1].trim() ?? null;
}
