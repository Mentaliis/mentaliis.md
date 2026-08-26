/** Menu contextuel du clic droit. */

import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  /** Absente quand l'entree ne sert qu'a ouvrir un sous-menu. */
  action?: () => void | Promise<void>;
  danger?: boolean;
  /** Marque l'option en vigueur, dans un sous-menu de choix. */
  checked?: boolean;
  /** Choix proposes au survol, deployes sur le cote. */
  submenu?: MenuItem[];
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!element.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // `capture` pour fermer avant qu'un autre clic droit n'ouvre un second menu.
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const run = async (item: MenuItem) => {
    // Une entree qui porte un sous-menu le deploie au lieu d'agir : le survol
    // l'ouvre deja, le clic doit faire pareil pour qui vise avant de cliquer.
    if (item.submenu) {
      setOpen((current) => (current === item.label ? null : item.label));
      return;
    }
    if (!item.action) return;
    onClose();
    await item.action();
  };

  return (
    <div
      ref={element}
      className="context-menu"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="context-menu__row"
          onPointerEnter={() => setOpen(item.submenu ? item.label : null)}
        >
          <button
            type="button"
            className={[
              "context-menu__item",
              item.danger && "is-danger",
              item.submenu && "has-submenu",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => void run(item)}
          >
            <span>{item.label}</span>
            {item.submenu && <span className="context-menu__arrow">›</span>}
          </button>

          {item.submenu && open === item.label && (
            <div className="context-menu context-menu--nested">
              {item.submenu.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  className={`context-menu__item${choice.checked ? " is-checked" : ""}`}
                  onClick={() => void run(choice)}
                >
                  <span className="context-menu__tick">{choice.checked ? "✓" : ""}</span>
                  <span>{choice.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
