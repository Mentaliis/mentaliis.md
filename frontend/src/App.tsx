/** Orchestration : le Vault ouvert, la scene courante, la note en cours d'edition. */

import { useCallback, useEffect, useState } from "react";
import { SceneView } from "./canvas/SceneView";
import { SearchPalette } from "./components/SearchPalette";
import { Topbar } from "./components/Topbar";
import { VaultPicker } from "./components/VaultPicker";
import { NoteEditor } from "./editor/NoteEditor";
import { api } from "./lib/api";
import type { Scene, VaultInfo } from "./lib/types";

type EngineState = "demarrage" | "pret" | "absent";

export default function App() {
  const [engine, setEngine] = useState<EngineState>("demarrage");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [changingVault, setChangingVault] = useState(false);
  const [path, setPath] = useState("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
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

  const loadScene = useCallback(
    async (target: string) => {
      if (!vault) return;
      try {
        setScene(await api.scene(target));
        setError(null);
      } catch (problem) {
        setError((problem as Error).message);
      }
    },
    [vault],
  );

  useEffect(() => {
    void loadScene(path);
  }, [loadScene, path]);

  const refresh = useCallback(() => void loadScene(path), [loadScene, path]);

  // Ctrl+K : recherche. Echap : refermer la note ouverte.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
      if (event.key === "Escape" && !searching) setNoteId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searching]);

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
        }}
        onCancel={vault ? () => setChangingVault(false) : undefined}
      />
    );
  }

  return (
    <div className={`app${noteId ? " app--editing" : ""}`}>
      <Topbar
        vault={vault}
        path={path}
        onNavigate={(target) => {
          setPath(target);
          setNoteId(null);
        }}
        onSearch={() => setSearching(true)}
        onChangeVault={() => setChangingVault(true)}
      />

      <main className="app__body">
        {scene ? (
          <SceneView
            scene={scene}
            activeNoteId={noteId}
            onEnterDoor={(target) => {
              setPath(target);
              setNoteId(null);
            }}
            onOpenNote={setNoteId}
            onSceneChanged={refresh}
          />
        ) : (
          <div className="boot">{error ?? "Chargement de la scene…"}</div>
        )}

        {noteId && (
          <NoteEditor
            key={noteId}
            noteId={noteId}
            onClose={() => setNoteId(null)}
            onSaved={refresh}
          />
        )}
      </main>

      {searching && (
        <SearchPalette
          onClose={() => setSearching(false)}
          onPick={(note) => {
            setSearching(false);
            // On se place dans la scene qui contient la note, puis on l'ouvre.
            setPath(note.parent);
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
