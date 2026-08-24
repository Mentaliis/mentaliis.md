"""Surveillance du Vault.

Le Vault reste un simple dossier : rien n'empeche de modifier une note depuis un
autre editeur, ou de deposer un fichier a la main. Le moteur surveille donc le
disque et previent l'interface, qui se rafraichit toute seule.

Les ecritures faites par l'application elle-meme sont ignorees : sinon chaque
frappe au clavier reviendrait en boucle sous forme de "changement externe".
"""

from __future__ import annotations

import asyncio
import contextlib
from pathlib import Path

from watchfiles import awatch

from .config import IGNORED_DIRS, NOTE_EXTENSIONS
from .vault.vault import IMAGE_EXTENSIONS, Vault

#: Extensions dont un changement interesse l'interface.
WATCHED_EXTENSIONS = NOTE_EXTENSIONS | IMAGE_EXTENSIONS

#: Laisse le temps a une salve d'ecritures de se terminer avant de prevenir.
SETTLE_MS = 250


class Watcher:
    """Diffuse les changements du disque aux interfaces connectees."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict]] = set()
        self._task: asyncio.Task | None = None
        self._stop: asyncio.Event | None = None

    # --- Abonnement ---

    def subscribe(self) -> asyncio.Queue[dict]:
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=64)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict]) -> None:
        self._subscribers.discard(queue)

    def _broadcast(self, message: dict) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # Une interface qui ne lit plus ne doit pas bloquer les autres.
                self._subscribers.discard(queue)

    # --- Cycle de vie ---

    async def watch(self, vault: Vault) -> None:
        """Surveille un Vault, en remplacant la surveillance precedente."""
        await self.stop()
        self._stop = asyncio.Event()
        self._task = asyncio.create_task(self._run(vault, self._stop))

    async def stop(self) -> None:
        if self._stop:
            self._stop.set()
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        self._task = None
        self._stop = None

    async def _run(self, vault: Vault, stop: asyncio.Event) -> None:
        try:
            async for changes in awatch(
                vault.root,
                stop_event=stop,
                debounce=SETTLE_MS,
                watch_filter=lambda _change, path: _is_relevant(vault, Path(path)),
            ):
                paths = sorted({str(path) for _change, path in changes})
                external = [path for path in paths if not vault.wrote_recently(Path(path))]
                if not external:
                    continue
                vault.invalidate_caches()
                self._broadcast(
                    {
                        "type": "vault-changed",
                        "paths": [_relative(vault, path) for path in external],
                    }
                )
        except asyncio.CancelledError:
            raise
        except Exception as error:  # pragma: no cover - depend du systeme de fichiers
            # Perdre la surveillance ne doit jamais faire tomber le moteur :
            # l'application reste utilisable, simplement sans rafraichissement auto.
            self._broadcast({"type": "watch-stopped", "reason": str(error)})


def _is_relevant(vault: Vault, path: Path) -> bool:
    try:
        parts = path.resolve().relative_to(vault.root).parts
    except ValueError:
        return False
    if any(part in IGNORED_DIRS or part.startswith(".") for part in parts):
        return False
    # Un dossier cree ou supprime n'a pas d'extension : c'est une porte, ca compte.
    return not path.suffix or path.suffix.lower() in WATCHED_EXTENSIONS


def _relative(vault: Vault, path: str) -> str:
    try:
        return Path(path).resolve().relative_to(vault.root).as_posix()
    except ValueError:
        return path


#: Instance unique, partagee par les routes.
watcher = Watcher()
