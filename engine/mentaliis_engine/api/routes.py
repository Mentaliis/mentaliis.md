"""Routes du moteur.

Toutes ces routes ne sont joignables que depuis la machine locale.
"""

from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from ..models import (
    Constellation,
    CreateDoorRequest,
    CreateNoteRequest,
    Door,
    MoveRequest,
    Note,
    NoteLinks,
    NoteSummary,
    OpenVaultRequest,
    RenameRequest,
    SaveNoteRequest,
    SceneResponse,
    SetCoverRequest,
    SetImagesRequest,
    VaultInfo,
)
from ..vault import VaultError, current_vault, open_vault
from ..vault.vault import ASSETS_DIR, last_vault
from ..watcher import watcher

router = APIRouter()


def _vault():
    try:
        return current_vault()
    except VaultError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


def _guard(callable_, *args, **kwargs):
    try:
        return callable_(*args, **kwargs)
    except VaultError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# --- Sante ---


@router.get("/health")
def health() -> dict:
    """Permet a l'interface de savoir que le moteur a fini de demarrer."""
    return {"status": "ok"}


# --- Vault ---


@router.get("/vault", response_model=VaultInfo | None)
def get_vault():
    try:
        return current_vault().info()
    except VaultError:
        return None


@router.get("/vault/last")
def get_last_vault() -> dict:
    return {"path": last_vault()}


@router.post("/vault/open", response_model=VaultInfo)
async def post_open_vault(payload: OpenVaultRequest) -> VaultInfo:
    vault = _guard(open_vault, payload.path)
    # La surveillance suit toujours le Vault ouvert.
    await watcher.watch(vault)
    return vault.info()


# --- Scenes ---


@router.get("/scene", response_model=SceneResponse)
def get_scene(path: str = Query("", description="Chemin de la porte, vide pour la racine")):
    return _guard(_vault().scene, path)


# --- Notes ---


@router.get("/note", response_model=Note)
def get_note(id: str = Query(..., description="Chemin de la note, relatif au Vault")):
    return _guard(_vault().read_note, id)


@router.put("/note", response_model=Note)
def put_note(payload: SaveNoteRequest, id: str = Query(...)):
    return _guard(_vault().write_note, id, payload.content)


@router.post("/note", response_model=NoteSummary)
def post_note(payload: CreateNoteRequest):
    return _guard(_vault().create_note, payload.parent, payload.title)


@router.put("/note/images", response_model=NoteSummary)
def put_note_images(payload: SetImagesRequest, id: str = Query(...)):
    return _guard(_vault().set_images, id, payload.images)


# --- Liens entre notes ---


@router.get("/links", response_model=NoteLinks)
def get_links(id: str = Query(..., description="Note dont on veut le voisinage")):
    return _guard(_vault().note_links, id)


@router.get("/links/resolve")
def get_resolve_link(target: str = Query(..., description="Texte d'un [[wikilink]]")):
    """Dit vers quelle note pointe un lien, ou None si elle reste a ecrire."""
    return {"id": _guard(_vault().resolve_link, target)}


# --- Vue d'ensemble ---


@router.get("/constellation", response_model=Constellation)
def get_constellation():
    return _guard(_vault().constellation)


@router.put("/move/global")
def put_move_global(payload: MoveRequest) -> dict:
    """Position dans la vue d'ensemble, distincte de celle dans la scene."""
    _guard(_vault().move_globally, payload.id, payload.position.x, payload.position.y)
    return {"ok": True}


# --- Portes ---


@router.post("/door", response_model=Door)
def post_door(payload: CreateDoorRequest):
    return _guard(_vault().create_door, payload.parent, payload.name)


@router.put("/door/cover", response_model=Door)
def put_door_cover(payload: SetCoverRequest, id: str = Query(...)):
    return _guard(_vault().set_cover, id, payload.cover)


# --- Operations communes ---


@router.put("/move")
def put_move(payload: MoveRequest) -> dict:
    _guard(_vault().move, payload.id, payload.position.x, payload.position.y)
    return {"ok": True}


@router.put("/rename")
def put_rename(payload: RenameRequest, id: str = Query(...)) -> dict:
    return {"id": _guard(_vault().rename, id, payload.name)}


@router.delete("/item")
def delete_item(id: str = Query(...)) -> dict:
    _guard(_vault().delete, id)
    return {"ok": True}


# --- Recherche ---


@router.get("/search", response_model=list[NoteSummary])
def get_search(q: str = Query("", description="Texte recherche"), limit: int = 50):
    return _guard(_vault().search, q, limit)


# --- Fichiers du Vault (images de couverture, images attachees) ---


@router.get("/file")
def get_file(path: str = Query(..., description="Chemin d'un fichier du Vault")):
    """Sert un fichier du Vault a l'interface (images notamment)."""
    target = _guard(_vault().resolve, path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    return FileResponse(target)


@router.post("/import")
async def post_import(
    file: UploadFile = File(...),
    folder: str = Query(ASSETS_DIR, description="Ou ranger le fichier dans le Vault"),
) -> dict:
    """Range dans le Vault un fichier depose depuis l'exterieur."""
    data = await file.read()
    path = _guard(_vault().import_file, file.filename or "image", data, folder)
    return {"path": path}


# --- Changements venus du disque ---


@router.websocket("/events")
async def events(socket: WebSocket) -> None:
    """Previent l'interface quand le Vault change en dehors de l'application."""
    await socket.accept()
    queue = watcher.subscribe()
    try:
        while True:
            # Un ping regulier detecte une interface partie sans prevenir.
            try:
                message = await asyncio.wait_for(queue.get(), timeout=25.0)
            except asyncio.TimeoutError:
                message = {"type": "ping"}
            await socket.send_json(message)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        watcher.unsubscribe(queue)
        with contextlib.suppress(RuntimeError):
            await socket.close()
