/** Orchestration : le Vault ouvert, la vue courante, les notes ouvertes en onglets. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConstellationView } from "./canvas/ConstellationView";
import { SceneView } from "./canvas/SceneView";
import { useDialog } from "./components/Dialog";
import { Rail } from "./components/Rail";
import { SearchPalette } from "./components/SearchPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { Tabs } from "./components/Tabs";
import { Topbar, type View } from "./components/Topbar";
import { UpdateBanner } from "./components/UpdateBanner";
import { VaultPicker } from "./components/VaultPicker";
import { NoteEditor } from "./editor/NoteEditor";
import { api } from "./lib/api";
import { useEngineEvents } from "./lib/useEngineEvents";
import { useSettings } from "./lib/useSettings";
import { useUpdater } from "./lib/useUpdater";
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
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog();
  const { settings, update: updateSettings } = useSettings();
  const updater = useUpdater();
  /** Largeur suivie pendant le glissement, avant d'etre enregistree. */
  const [railWidth, setRailWidth] = useState<number | null>(null);

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

  /**
   * Un element renomme garde sa place. Renommer une porte deplace aussi tout ce
   * qu'elle contient : les onglets ouverts sur ses notes doivent suivre, sinon
   * ils pointeraient vers des fichiers qui n'existent plus.
   */
  const retarget = useCallback((oldId: string, newId: string, title?: string) => {
    const suivi = (id: string) =>
      id === oldId ? newId : id.startsWith(`${oldId}/`) ? newId + id.slice(oldId.length) : id;
    setTabs((current) =>
      current.map((tab) => {
        const id = suivi(tab.id);
        if (id === tab.id) return tab;
        return { id, title: id === newId && title ? title : tab.title };
      }),
    );
    setActive((current) => (current ? suivi(current) : current));
  }, []);

  /** Le titre lu dans le texte, repercute sans attendre l'enregistrement. */
  const setNoteTitle = useCallback((id: string, title: string) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === id && tab.title !== title ? { ...tab, title } : tab)),
    );
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
      if (meta && event.key === ",") {
        event.preventDefault();
        setShowSettings((open) => !open);
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

  // Le clic droit appartient a l'application : jamais de menu du navigateur,
  // qui donnerait acces a l'inspecteur et trahirait qu'on est dans une page web.
  // Les elements qui ont leur propre menu arretent l'evenement avant d'arriver ici.
  useEffect(() => {
    const swallow = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("contextmenu", swallow);
    return () => window.removeEventListener("contextmenu", swallow);
  }, []);

  const enterDoor = useCallback((target: string) => {
    setPath(target);
    setView("scene");
  }, []);

  const goUp = useCallback(() => setPath((current) => current.split("/").slice(0, -1).join("/")), []);

  const navigate = useCallback(
    (target: string) => {
      enterDoor(target);
      closeAll();
    },
    [closeAll, enterDoor],
  );

  const changeView = useCallback(
    (next: View) => {
      closeAll();
      setView(next);
    },
    [closeAll],
  );

  const leaveConstellation = useCallback(
    (target: string) => {
      enterDoor(target);
      setView("scene");
    },
    [enterDoor],
  );

  /** Une note neuve, sans rien demander : on la nomme apres, si l'on veut. */
  const quickNote = useCallback(async () => {
    try {
      const created = await api.createNote(path, "Nouvelle Note");
      refresh();
      openNote(created.id, created.title);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }, [openNote, path, refresh]);

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
        onNavigate={navigate}
        onChangeView={changeView}
        onSearch={() => setSearching(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <Tabs
        tabs={tabs}
        active={active}
        onSelect={setActive}
        onClose={closeNote}
        onCloseAll={closeAll}
        onCreate={quickNote}
      />

      <main className="app__body">
        {editing ? (
          <>
            <Rail
              scene={scene}
              activeNoteId={active}
              width={railWidth ?? settings.rail_width}
              onEnterDoor={enterDoor}
              onGoUp={goUp}
              onOpenNote={openNote}
              onCreateNote={createNote}
              onResize={setRailWidth}
              onResizeEnd={(largeur) => {
                setRailWidth(null);
                updateSettings({ rail_width: largeur });
              }}
            />
            <NoteEditor
              key={active}
              noteId={active}
              reloadToken={noteReload}
              onSaved={refresh}
              onOpenNote={openNote}
              onRenamed={retarget}
              onTitle={setNoteTitle}
            />
          </>
        ) : view === "constellation" ? (
          sky ? (
            <ConstellationView
              data={sky}
              activeNoteId={active}
              onEnterDoor={leaveConstellation}
              onOpenNote={openNote}
            />
          ) : (
            <div className="boot">{error ?? "Assemblage de la constellation…"}</div>
          )
        ) : scene ? (
          <SceneView
            scene={scene}
            activeNoteId={active}
            onEnterDoor={enterDoor}
            onOpenNote={openNote}
            onSceneChanged={refresh}
            onRenamed={retarget}
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

      {showSettings && (
        <SettingsPanel
          settings={settings}
          vault={vault}
          onChange={updateSettings}
          onChangeVault={() => setChangingVault(true)}
          onClose={() => setShowSettings(false)}
          updateState={updater.state}
          onCheckUpdate={() => void updater.chercher()}
        />
      )}

      <UpdateBanner
        state={updater.state}
        onInstall={() => void updater.installer()}
        onDismiss={updater.ignorer}
      />

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}
