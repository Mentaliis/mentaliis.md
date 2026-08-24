/** Les notes ouvertes, une par onglet. */

interface Tab {
  id: string;
  title: string;
}

interface Props {
  tabs: Tab[];
  active: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** Referme toutes les notes et revient a l'environnement. */
  onCloseAll: () => void;
}

export function Tabs({ tabs, active, onSelect, onClose, onCloseAll }: Props) {
  if (!tabs.length) return null;

  return (
    <div className="tabs">
      <div className="tabs__strip">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab${tab.id === active ? " is-active" : ""}`}
            title={tab.id}
            onPointerDown={(event) => {
              // Le clic du milieu referme, comme dans un navigateur.
              if (event.button === 1) {
                event.preventDefault();
                onClose(tab.id);
              } else if (event.button === 0) {
                onSelect(tab.id);
              }
            }}
          >
            <span className="tab__title">{tab.title}</span>
            <button
              type="button"
              className="tab__close"
              title="Fermer"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onClose(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="tabs__back" onClick={onCloseAll} title="Revenir aux portes">
        Retour aux portes
      </button>
    </div>
  );
}
