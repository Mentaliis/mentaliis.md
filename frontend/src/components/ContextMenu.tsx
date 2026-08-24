/** Menu contextuel du clic droit. */

import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  action: () => void | Promise<void>;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const element = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={element}
      className="context-menu"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={item.danger ? "context-menu__item is-danger" : "context-menu__item"}
          onClick={async () => {
            onClose();
            await item.action();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
