/** Orchestration : le Vault ouvert, la vue courante, les notes ouvertes en onglets. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConstellationView } from "./canvas/ConstellationView";
import { SceneView } from "./canvas/SceneView";
import { useDialog } from "./components/Dialog";
import { Rail } from "./components/Rail";
import { SearchPalette } from "./components/SearchPalette";
import { Tabs } from "./components/Tabs";
import { Topbar, type View } from "./components/Topbar";
import { VaultPicker } from "./components/VaultPicker";
import { NoteEditor } from "./editor/NoteEditor";
import { api } from "./lib/api";
import { useEngineEvents } from "./lib/useEngineEvents";
import type { Constellation, Scene, VaultInfo } from "./lib/types";

type EngineState = "demarrage" | "pret" | "absent";

/** Une note ouverte dans un onglet. */
interface OpenNote {
  id: string;
  title: string;
}

export default function App() {
  const [engine, setEngine] = useState<EngineState>("demarrage");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [changingVault, setChangingVault] = useState(false);
  const [view, setView] = useState<View>("scene");
  const [path, setPath] = useState("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [sky, setSky] = useState<Constellation | null>(null);
  const [tabs, setTabs] = useState<OpenNote[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [noteReload, setNoteReload] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog();

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

  // --- Chargement ---

  const loadScene = useCallback(async () => {
    if (!vault) return;
    try {
      setScene(await api.scene(path));
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [path, vault]);

  const loadSky = useCallback(async () => {
    if (!vault) return;
    try {
      setSky(await api.constellation());
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [vault]);

  // La scene est toujours chargee : c'est elle qui alimente la bande de gauche
  // pendant l'ecriture, meme quand l'environnement n'est pas a l'ecran.
  useEffect(() => {
    void loadScene();
  }, [loadScene]);

  useEffect(() => {
    if (view === "constellation") void loadSky();
  }, [loadSky, view]);

  const refresh = useCallback(() => {
    void loadScene();
    if (view === "constellation") void loadSky();
  }, [loadScene, loadSky, view]);

  // --- Onglets ---

  const openNote = useCallback((id: string, title?: string) => {
    setTabs((current) =>
      current.some((tab) => tab.id === id)
        ? current
        : [...current, { id, title: title ?? id.split("/").pop()?.replace(/\.md$/i, "") ?? id }],
    );
    setActive(id);
  }, []);

  const closeNote = useCallback((id: string) => {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      setActive((currentActive) => {
        if (currentActive !== id) return currentActive;
        // On bascule sur la voisine, comme dans un navigateur.
        const index = current.findIndex((tab) => tab.id === id);
        return next[Math.min(index, next.length - 1)]?.id ?? null;
      });
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setTabs([]);
    setActive(null);
  }, []);

  // Garde les titres des onglets a jour quand une note est renommee ou modifiee.
  useEffect(() => {
    if (!scene) return;
    setTabs((current) =>
      current.map((tab) => {
        const found = scene.notes.find((note) => note.id === tab.id);
        return found && found.title !== tab.title ? { ...tab, title: found.title } : tab;
      }),
    );
  }, [scene]);

  // --- Changements venus du disque ---

  const activeRef = useRef<string | null>(null);
  activeRef.current = active;
  useEngineEvents(
    useCallback(
      (paths) => {
        refresh();
        if (activeRef.current && paths.includes(activeRef.current)) {
          setNoteReload((token) => token + 1);
        }
      },
      [refresh],
    ),
  );

  // --- Raccourcis ---

  const editing = active !== null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (meta && key === "k") {
        event.preventDefault();
        setSearching(true);
        return;
      }
      if (meta && key === "g") {
        event.preventDefault();
        closeAll();
        setView((current) => (current === "scene" ? "constellation" : "scene"));
        return;
      }
      if (meta && key === "w" && activeRef.current) {
        event.preventDefault();
        closeNote(activeRef.current);
        return;
      }
      if (meta && event.key === "Tab") {
        event.preventDefault();
        setTabs((current) => {
          if (current.length < 2) return current;
          const index = current.findIndex((tab) => tab.id === activeRef.current);
          const step = event.shiftKey ? -1 : 1;
          setActive(current[(index + step + current.length) % current.length].id);
          return current;
        });
        return;
      }
      if (event.key === "Escape" && !searching && activeRef.current) {
        closeNote(activeRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAll, closeNote, searching]);

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

  const enterDoor = useCallback((target: string) => {
    setPath(target);
    setView("scene");
  }, []);

  const createNote = useCallback(async () => {
    const title = await dialog.prompt({
      title: "Nouvelle note",
      message: `Dans ${scene?.name ?? "le Vault"}.`,
      value: "Sans titre",
      confirmLabel: "Creer",
    });
    if (!title) return;
    try {
      const created = await api.createNote(path, title);
      refresh();
      openNote(created.id, created.title);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [dialog, openNote, path, refresh, scene?.name]);

  const activeTitle = useMemo(
    () => tabs.find((tab) => tab.id === active)?.title,
    [active, tabs],
  );

  // --- Rendu ---

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
          setView("scene");
          closeAll();
        }}
        onCancel={vault ? () => setChangingVault(false) : undefined}
      />
    );
  }

  return (
    <div className={`app${editing ? " app--editing" : ""}`}>
      <Topbar
        vault={vault}
        path={path}
        view={view}
        editingTitle={editing ? activeTitle : undefined}
        onNavigate={(target) => {
          enterDoor(target);
          closeAll();
        }}
        onChangeView={(next) => {
          closeAll();
          setView(next);
        }}
        onSearch={() => setSearching(true)}
        onChangeVault={() => setChangingVault(true)}
      />

      <Tabs
        tabs={tabs}
        active={active}
        onSelect={setActive}
        onClose={closeNote}
        onCloseAll={closeAll}
      />

      <main className="app__body">
        {editing ? (
          <>
            <Rail
              scene={scene}
              activeNoteId={active}
              onEnterDoor={enterDoor}
              onGoUp={() => setPath(path.split("/").slice(0, -1).join("/"))}
              onOpenNote={(id) => openNote(id)}
              onCreateNote={() => void createNote()}
            />
            <NoteEditor
              key={active}
              noteId={active}
              reloadToken={noteReload}
              onSaved={refresh}
              onOpenNote={(id) => openNote(id)}
            />
          </>
        ) : view === "constellation" ? (
          sky ? (
            <ConstellationView
              data={sky}
              activeNoteId={active}
              onEnterDoor={(target) => {
                enterDoor(target);
                setView("scene");
              }}
              onOpenNote={(id) => openNote(id)}
            />
          ) : (
            <div className="boot">{error ?? "Assemblage de la constellation…"}</div>
          )
        ) : scene ? (
          <SceneView
            scene={scene}
            activeNoteId={active}
            onEnterDoor={enterDoor}
            onOpenNote={(id) => openNote(id)}
            onSceneChanged={refresh}
            onError={setError}
          />
        ) : (
          <div className="boot">{error ?? "Chargement de la scene…"}</div>
        )}
      </main>

      {searching && (
        <SearchPalette
          onClose={() => setSearching(false)}
          onPick={(note) => {
            setSearching(false);
            setPath(note.parent);
            openNote(note.id, note.title);
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
