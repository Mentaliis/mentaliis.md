/** Orchestration : le Vault ouvert, la vue courante, la note en cours d'edition. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ConstellationView } from "./canvas/ConstellationView";
import { SceneView } from "./canvas/SceneView";
import { SearchPalette } from "./components/SearchPalette";
import { Topbar, type View } from "./components/Topbar";
import { VaultPicker } from "./components/VaultPicker";
import { NoteEditor } from "./editor/NoteEditor";
import { api } from "./lib/api";
import { useEngineEvents } from "./lib/useEngineEvents";
import type { Constellation, Scene, VaultInfo } from "./lib/types";

type EngineState = "demarrage" | "pret" | "absent";

export default function App() {
  const [engine, setEngine] = useState<EngineState>("demarrage");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [changingVault, setChangingVault] = useState(false);
  const [view, setView] = useState<View>("scene");
  const [path, setPath] = useState("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [sky, setSky] = useState<Constellation | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteReload, setNoteReload] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attend que le moteur reponde : il peut demarrer un peu apres la fenetre.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const ping = async () => {
      try {
        await api.health();
        if (cancelled) return;
        setEngine("pret");
        const existing = await api.getVault();
        if (!cancelled && existing) setVault(existing);
      } catch {
        if (cancelled) return;
        if (++attempts > 20) setEngine("absent");
        else window.setTimeout(ping, 400);
      }
    };
    void ping();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!vault) return;
    try {
      if (view === "constellation") setSky(await api.constellation());
      else setScene(await api.scene(path));
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [path, vault, view]);

  useEffect(() => {
    void load();
  }, [load]);

  // Le Vault reste un dossier ordinaire : si le disque bouge, la vue suit.
  const openNoteId = useRef<string | null>(null);
  openNoteId.current = noteId;
  useEngineEvents(
    useCallback(
      (paths) => {
        void load();
        // Si la note ouverte est celle qui a change, il faut la relire.
        if (openNoteId.current && paths.includes(openNoteId.current)) {
          setNoteReload((token) => token + 1);
        }
      },
      [load],
    ),
  );

  // Ctrl+K : recherche. Ctrl+G : vue d'ensemble. Echap : refermer la note.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
      if (meta && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setView((current) => (current === "scene" ? "constellation" : "scene"));
      }
      if (event.key === "Escape" && !searching) setNoteId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searching]);

  // Une image lachee a cote d'une cible ne doit pas etre ouverte par le navigateur.
  useEffect(() => {
    const swallow = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  if (engine === "absent") {
    return (
      <div className="boot boot--error">
        <h1>Le moteur ne repond pas</h1>
        <p>
          Demarrez-le depuis le dossier <code>engine</code> :
          <br />
          <code>python -m mentaliis_engine.main</code>
        </p>
      </div>
    );
  }

  if (engine === "demarrage") {
    return <div className="boot">Demarrage du moteur…</div>;
  }

  if (!vault || changingVault) {
    return (
      <VaultPicker
        onOpened={(opened) => {
          setVault(opened);
          setChangingVault(false);
          setPath("");
          setNoteId(null);
          setView("scene");
        }}
        onCancel={vault ? () => setChangingVault(false) : undefined}
      />
    );
  }

  const enterDoor = (target: string) => {
    setPath(target);
    setNoteId(null);
    setView("scene");
  };

  return (
    <div className={`app${noteId ? " app--editing" : ""}`}>
      <Topbar
        vault={vault}
        path={path}
        view={view}
        onNavigate={enterDoor}
        onChangeView={setView}
        onSearch={() => setSearching(true)}
        onChangeVault={() => setChangingVault(true)}
      />

      <main className="app__body">
        {view === "constellation" ? (
          sky ? (
            <ConstellationView
              data={sky}
              activeNoteId={noteId}
              onEnterDoor={enterDoor}
              onOpenNote={setNoteId}
            />
          ) : (
            <div className="boot">{error ?? "Assemblage de la constellation…"}</div>
          )
        ) : scene ? (
          <SceneView
            scene={scene}
            activeNoteId={noteId}
            onEnterDoor={enterDoor}
            onOpenNote={setNoteId}
            onSceneChanged={() => void load()}
            onError={setError}
          />
        ) : (
          <div className="boot">{error ?? "Chargement de la scene…"}</div>
        )}

        {noteId && (
          <NoteEditor
            key={noteId}
            noteId={noteId}
            reloadToken={noteReload}
            onClose={() => setNoteId(null)}
            onSaved={() => void load()}
            onOpenNote={setNoteId}
          />
        )}
      </main>

      {searching && (
        <SearchPalette
          onClose={() => setSearching(false)}
          onPick={(note) => {
            setSearching(false);
            // On se place dans la scene qui contient la note, puis on l'ouvre.
            if (view === "scene") setPath(note.parent);
            setNoteId(note.id);
          }}
        />
      )}

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}
