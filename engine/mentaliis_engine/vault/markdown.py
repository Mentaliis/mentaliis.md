"""Lecture et ecriture des fichiers markdown."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import frontmatter

# `![[image.png]]` embarque un fichier : ce n'est pas un lien vers une note.
WIKILINK_RE = re.compile(r"(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
TAG_RE = re.compile(r"(?:^|\s)#([A-Za-z0-9_\-/]{1,60})")
#: Le titre d'une note est le `# ` de sa toute premiere ligne — pas un titre
#: quelconque ecrit plus bas. Sans cela, ajouter un « # » au milieu du texte
#: renommerait la note sous les yeux de celui qui ecrit.
HEADING_RE = re.compile(r"\A#[ \t]+(.+)")


def read(path: Path) -> tuple[str, dict[str, Any]]:
    """Retourne (contenu markdown sans frontmatter, frontmatter)."""
    raw = path.read_text(encoding="utf-8")
    try:
        post = frontmatter.loads(raw)
    except Exception:
        # Un frontmatter mal forme ne doit pas rendre la note illisible.
        return raw, {}
    return post.content, dict(post.metadata)


def write(path: Path, content: str, metadata: dict[str, Any] | None = None) -> None:
    """Ecrit une note, en reinjectant son frontmatter s'il y en a un."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if metadata:
        post = frontmatter.Post(content, **metadata)
        payload = frontmatter.dumps(post)
    else:
        payload = content
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8", newline="\n")
    tmp.replace(path)


def title_of(path: Path, content: str, metadata: dict[str, Any]) -> str:
    """Titre affiche sous une note : frontmatter > titre de tete > nom de fichier."""
    fm_title = metadata.get("title")
    if isinstance(fm_title, str) and fm_title.strip():
        return fm_title.strip()
    heading = HEADING_RE.search(content)
    if heading:
        return heading.group(1).strip()
    return path.stem


def with_title(content: str, title: str) -> str:
    """Reecrit le premier titre du texte, ou en pose un si le texte n'en a pas."""
    heading = HEADING_RE.search(content)
    if heading:
        return content[: heading.start()] + f"# {title}" + content[heading.end() :]
    pose = f"# {title}\n\n"
    return pose + content.lstrip() if content.strip() else pose


#: De quoi retirer d'un extrait tout ce qui n'est que de la syntaxe.
_SANS_SYNTAXE: tuple[tuple[re.Pattern[str], str], ...] = (
    # Images et liens : on ne garde que ce qui se lit.
    (re.compile(r"!\[\[([^\]|]*)(?:\|[^\]]*)?\]\]"), ""),
    (re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]"), r"\1"),
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), ""),
    (re.compile(r"\[([^\]]*)\]\([^)]*\)"), r"\1"),
    # Marqueurs de style.
    (re.compile(r"(\*\*|__|~~|`)"), ""),
    (re.compile(r"(?<![\w*])\*(?![\s*])"), ""),
    (re.compile(r"(?<![\s*])\*(?![\w*])"), ""),
    # Debuts de ligne : puces, cases, citations, numeros.
    (re.compile(r"^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*"), ""),
    (re.compile(r"^\s*(?:[-*+]|\d+\.)\s+"), ""),
    (re.compile(r"^\s*>+\s*"), ""),
)


def excerpt_of(content: str, limit: int = 160) -> str:
    """Quelques mots de la note, pour l'apercu sur la carte.

    L'extrait est nettoye de sa syntaxe : une carte doit montrer du texte, pas
    des etoiles et des crochets, comme partout ailleurs dans l'application.
    """
    lines: list[str] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("---"):
            continue
        # Un tableau ou une formule en bloc n'ont rien a dire en une ligne.
        if stripped.startswith("|") or stripped.startswith("$$") or stripped.startswith("```"):
            continue
        for motif, remplacement in _SANS_SYNTAXE:
            stripped = motif.sub(remplacement, stripped)
        # Ce qui a ete retire laisse des blancs derriere lui.
        stripped = re.sub(r"\s{2,}", " ", stripped).strip()
        if not stripped:
            continue
        lines.append(stripped)
        if sum(len(item) for item in lines) >= limit:
            break
    text = " ".join(lines)
    return text[:limit].rstrip() + ("..." if len(text) > limit else "")


def tags_of(content: str, metadata: dict[str, Any]) -> list[str]:
    """Tags issus du frontmatter et du corps (#tag)."""
    found: list[str] = []
    raw = metadata.get("tags")
    if isinstance(raw, str):
        found.extend(part.strip() for part in raw.split(",") if part.strip())
    elif isinstance(raw, list):
        found.extend(str(part).strip() for part in raw if str(part).strip())
    found.extend(match.group(1) for match in TAG_RE.finditer(content))
    # dedoublonne en preservant l'ordre d'apparition
    return list(dict.fromkeys(found))


def wikilinks_of(content: str) -> list[str]:
    """Cibles des liens [[wikilink]] presents dans la note."""
    return list(dict.fromkeys(match.group(1).strip() for match in WIKILINK_RE.finditer(content)))
