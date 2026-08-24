"""Reseau de liens du Vault.

Une note en cite une autre avec `[[Nom de la note]]`. L'index sait, pour chaque
note, ce qu'elle cite (liens sortants) et qui la cite (liens entrants, ou
backlinks) — c'est ce qui transforme une pile de fichiers en un reseau.

L'index est reconstruit paresseusement : on le marque perime a chaque ecriture,
et il se refait a la premiere question posee.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import TYPE_CHECKING

from ..models import Edge, LinkRef, NoteLinks
from ..vault import markdown as md

if TYPE_CHECKING:  # pragma: no cover
    from ..vault.vault import Vault


class LinkIndex:
    """Construit et interroge le reseau de liens d'un Vault."""

    def __init__(self, vault: Vault) -> None:
        self._vault = vault
        self._lock = threading.Lock()
        self._stale = True
        #: note -> titre affiche
        self._titles: dict[str, str] = {}
        #: note -> cibles ecrites, telles quelles
        self._raw: dict[str, list[str]] = {}
        #: note -> notes citees, resolues
        self._outgoing: dict[str, list[str]] = {}
        #: note -> notes qui la citent
        self._incoming: dict[str, list[str]] = {}
        #: cible ecrite, en minuscules -> note
        self._lookup: dict[str, str] = {}

    def invalidate(self) -> None:
        """A appeler des que le contenu du Vault change."""
        self._stale = True

    # --- Construction ---

    def _ensure(self) -> None:
        if not self._stale:
            return
        with self._lock:
            if not self._stale:
                return
            self._build()
            self._stale = False

    def _build(self) -> None:
        titles: dict[str, str] = {}
        raw: dict[str, list[str]] = {}
        lookup: dict[str, str] = {}

        for file in self._vault._all_notes():
            note_id = self._vault.relative(file)
            try:
                content, meta = md.read(file)
            except OSError:
                continue
            title = md.title_of(file, content, meta)
            titles[note_id] = title
            raw[note_id] = md.wikilinks_of(content)

            # Une note se cite de plusieurs facons : par son nom de fichier, par
            # son titre, ou par son chemin complet. Le premier inscrit gagne, ce
            # qui rend la resolution stable d'une reconstruction a l'autre.
            for key in self._aliases(note_id, title):
                lookup.setdefault(key, note_id)

        outgoing: dict[str, list[str]] = {}
        incoming: dict[str, list[str]] = {note_id: [] for note_id in titles}
        for note_id, targets in raw.items():
            resolved: list[str] = []
            for target in targets:
                found = lookup.get(_normalise(target))
                if found and found != note_id and found not in resolved:
                    resolved.append(found)
                    incoming[found].append(note_id)
            outgoing[note_id] = resolved

        self._titles, self._raw, self._lookup = titles, raw, lookup
        self._outgoing, self._incoming = outgoing, incoming

    @staticmethod
    def _aliases(note_id: str, title: str) -> list[str]:
        path = Path(note_id)
        return [
            _normalise(path.stem),
            _normalise(title),
            _normalise(note_id),
            _normalise(note_id[: -len(path.suffix)] if path.suffix else note_id),
        ]

    # --- Interrogation ---

    def links_for(self, note_id: str) -> NoteLinks:
        self._ensure()
        outgoing = [self._ref(target) for target in self._outgoing.get(note_id, [])]
        backlinks = [self._ref(source) for source in self._incoming.get(note_id, [])]
        resolved = {_normalise(target) for target in self._outgoing.get(note_id, [])}
        unresolved = [
            written
            for written in self._raw.get(note_id, [])
            if _normalise(written) not in self._lookup
            and _normalise(written) not in resolved
        ]
        return NoteLinks(
            id=note_id,
            outgoing=outgoing,
            backlinks=backlinks,
            unresolved=list(dict.fromkeys(unresolved)),
        )

    def edges(self) -> list[Edge]:
        """Toutes les liaisons du Vault, sans doublon ni sens."""
        self._ensure()
        seen: set[tuple[str, str]] = set()
        result: list[Edge] = []
        for source, targets in self._outgoing.items():
            for target in targets:
                pair = tuple(sorted((source, target)))
                if pair in seen:
                    continue
                seen.add(pair)
                result.append(Edge(source=source, target=target))
        return result

    def _ref(self, note_id: str) -> LinkRef:
        return LinkRef(id=note_id, title=self._titles.get(note_id, Path(note_id).stem))

    def resolve(self, target: str) -> str | None:
        """Note designee par un [[wikilink]], ou None si elle n'existe pas."""
        self._ensure()
        return self._lookup.get(_normalise(target))


def _normalise(value: str) -> str:
    return value.strip().strip("/").replace("\\", "/").lower()
