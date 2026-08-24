/**
 * Les boites de dialogue de l'application.
 *
 * Aucune fenetre du navigateur : `window.prompt` et `window.confirm` bloquent
 * tout, ne se laissent pas habiller, et affichent « localhost:1420 indique » —
 * de quoi rappeler a chaque renommage qu'on n'est pas dans un vrai logiciel.
 *
 * A la place, un dialogue dessine dans l'application, qui s'utilise exactement
 * comme les anciens :
 *
 *     const nom = await dialog.prompt({ title: "Renommer", value: "Notes" });
 *     if (await dialog.confirm({ title: "Supprimer ?", danger: true })) { … }
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface PromptOptions {
  title: string;
  /** Precision affichee sous le titre. */
  message?: string;
  /** Texte propose, selectionne a l'ouverture. */
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Colore l'action en rouge : suppression, detachement… */
  danger?: boolean;
}

interface DialogApi {
  /** Demande un texte. Renvoie `null` si l'utilisateur annule. */
  prompt: (options: PromptOptions) => Promise<string | null>;
  /** Demande une confirmation. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

type Request =
  | { kind: "prompt"; options: PromptOptions; settle: (value: string | null) => void }
  | { kind: "confirm"; options: ConfirmOptions; settle: (value: boolean) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog doit etre utilise dans un DialogProvider.");
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      prompt: (options) =>
        new Promise((resolve) => setRequest({ kind: "prompt", options, settle: resolve })),
      confirm: (options) =>
        new Promise((resolve) => setRequest({ kind: "confirm", options, settle: resolve })),
    }),
    [],
  );

  const close = useCallback(
    (value: string | null | boolean) => {
      setRequest(null);
      if (!request) return;
      if (request.kind === "prompt") request.settle(value === false ? null : (value as string | null));
      else request.settle(Boolean(value));
    },
    [request],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request && <DialogWindow request={request} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogWindow({
  request,
  onClose,
}: {
  request: Request;
  onClose: (value: string | null | boolean) => void;
}) {
  const isPrompt = request.kind === "prompt";
  const [text, setText] = useState(isPrompt ? (request.options.value ?? "") : "");
  const input = useRef<HTMLInputElement>(null);
  const action = useRef<HTMLButtonElement>(null);

  // Le nom propose est selectionne : taper le remplace, comme on s'y attend.
  useEffect(() => {
    if (isPrompt) {
      input.current?.focus();
      input.current?.select();
    } else {
      action.current?.focus();
    }
  }, [isPrompt]);

  // Echap annule, ou que soit le focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // Le dialogue passe avant les raccourcis de l'application.
      event.stopPropagation();
      onClose(isPrompt ? null : false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isPrompt, onClose]);

  const validate = () => {
    if (!isPrompt) {
      onClose(true);
      return;
    }
    const cleaned = text.trim();
    if (cleaned) onClose(cleaned);
  };

  const options = request.options;
  const danger = !isPrompt && (request.options as ConfirmOptions).danger;
  const empty = isPrompt && !text.trim();

  return (
    <div
      className="dialog__veil"
      onPointerDown={(event) => {
        // Cliquer a cote ferme, mais un glissement parti du dialogue ne compte pas.
        if (event.target === event.currentTarget) onClose(isPrompt ? null : false);
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={options.title}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h2 className="dialog__title">{options.title}</h2>
        {options.message && <p className="dialog__message">{options.message}</p>}

        {isPrompt && (
          <input
            ref={input}
            className="dialog__input"
            value={text}
            placeholder={(options as PromptOptions).placeholder}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                validate();
              }
            }}
          />
        )}

        <div className="dialog__actions">
          <button
            type="button"
            className="dialog__cancel"
            onClick={() => onClose(isPrompt ? null : false)}
          >
            Annuler
          </button>
          <button
            ref={action}
            type="button"
            className={`dialog__confirm${danger ? " is-danger" : ""}`}
            disabled={empty}
            onClick={validate}
          >
            {options.confirmLabel ?? (isPrompt ? "Valider" : "Confirmer")}
          </button>
        </div>
      </div>
    </div>
  );
}
