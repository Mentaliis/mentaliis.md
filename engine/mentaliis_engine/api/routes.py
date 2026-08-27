"""Routes du moteur.

Toutes ces routes ne sont joignables que depuis la machine locale.
"""

from __future__ import annotations

import asyncio
import contextlib
import os

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from .. import settings
from ..models import (
    AddSceneImageRequest,
    Constellation,
    CreateDoorRequest,
    CreateNoteRequest,
    Door,
    LinkRequest,
    MediaLibrary,
    MoveRequest,
    Note,
    NoteLinks,
    NoteSummary,
    OpenVaultRequest,
    RenameRequest,
    RetitleRequest,
    SaveNoteRequest,
    SceneImage,
    SceneLink,
    SceneResponse,
    SetCameraRequest,
    SetCoverRequest,
    Folder,
    MoveToRequest,
    SetIconRequest,
    SetIconSizeRequest,
    SetImagesRequest,
    SetSizeRequest,
    Settings,
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
    """Dit que le moteur est pret — et surtout, dit lequel il est.

    Le port peut deja etre occupe : un second Mentaliis, ou un moteur de
    developpement reste ouvert. La fenetre s'attacherait alors a celui-la sans
    rien remarquer, et travaillerait sur un tout autre Vault que celui attendu.
    Le jeton, tire au sort par la coquille a chaque lancement et transmis au
    moteur qu'elle demarre, permet a l'interface de reconnaitre le sien.
    """
    return {"status": "ok", "token": os.environ.get("MENTALIIS_TOKEN")}


# --- Vault ---


@router.get("/vault", response_model=VaultInfo | None)
def get_vault():
    try:
        return current_vault().info()
    except VaultError:
        return None


# --- Preferences ---


@router.get("/settings", response_model=Settings)
def get_settings() -> Settings:
    return settings.load()


@router.put("/settings", response_model=Settings)
def put_settings(payload: Settings) -> Settings:
    return settings.save(payload)


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


@router.put("/note/title", response_model=Note)
def put_note_title(payload: RetitleRequest, id: str = Query(...)):
    """Change le titre d'une note : son texte et son nom de fichier ensemble."""
    return _guard(_vault().retitle, id, payload.title)


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


@router.put("/camera")
def put_camera(
    payload: SetCameraRequest,
    path: str = Query("", description="Scene concernee, ou @constellation"),
) -> dict:
    """Retient le cadrage d'une scene, pour la retrouver telle qu'on l'a laissee."""
    _guard(_vault().set_camera, path, payload.camera)
    return {"ok": True}


@router.put("/move/global")
def put_move_global(payload: MoveRequest) -> dict:
    """Position dans la vue d'ensemble, distincte de celle dans la scene."""
    _guard(_vault().move_globally, payload.id, payload.position.x, payload.position.y)
    return {"ok": True}


# --- Reserve de medias ---


@router.get("/media", response_model=MediaLibrary)
def get_media():
    """La reserve `.MEDIAS` : ses images, et les icones de `.MEDIAS/.SVG`."""
    return _guard(_vault().media)


# --- Images posees dans une scene ---


@router.post("/scene/image", response_model=SceneImage)
def post_scene_image(payload: AddSceneImageRequest):
    """Pose une image de la reserve dans une scene, a cote des portes."""
    return _guard(_vault().add_scene_image, payload.parent, payload.path)


@router.put("/scene/image/size", response_model=SceneImage)
def put_scene_image_size(payload: SetSizeRequest, id: str = Query(...)):
    return _guard(_vault().set_image_size, id, payload.size)


# --- Traits entre elements ---


@router.post("/link", response_model=SceneLink)
def post_link(payload: LinkRequest):
    """Attache deux elements d'une meme scene."""
    return _guard(_vault().link, payload.source, payload.target)


@router.delete("/link")
def delete_link(source: str = Query(...), target: str = Query(...)) -> dict:
    """Detache un trait. Detacher ce qui ne l'est pas ne fait rien."""
    _guard(_vault().unlink, source, target)
    return {"ok": True}


# --- Portes ---


@router.post("/door", response_model=Door)
def post_door(payload: CreateDoorRequest):
    return _guard(_vault().create_door, payload.parent, payload.name)


@router.put("/door/cover", response_model=Door)
def put_door_cover(payload: SetCoverRequest, id: str = Query(...)):
    return _guard(_vault().set_cover, id, payload.cover)


@router.get("/folders", response_model=list[Folder])
def get_folders():
    """Tous les dossiers du Vault, pour choisir ou ranger un element."""
    return _guard(_vault().folders)


@router.put("/move-to")
def put_move_to(payload: MoveToRequest, id: str = Query(...)) -> dict:
    """Range une note ou une porte dans un autre dossier."""
    return {"id": _guard(_vault().move_to, id, payload.destination)}


@router.put("/door/icon-size", response_model=Door)
def put_door_icon_size(payload: SetIconSizeRequest, id: str = Query(...)):
    """Trois echelles pour l'icone d'une porte : 1, 2 ou 3."""
    return _guard(_vault().set_icon_size, id, payload.size)


@router.put("/door/icon", response_model=Door)
def put_door_icon(payload: SetIconRequest, id: str = Query(...)):
    """Porte ou cerveau : deux facons de se representer un dossier."""
    return _guard(_vault().set_icon, id, payload.icon)


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


@router.get("/asset")
def get_asset(ref: str = Query(..., description="Nom ou chemin d'une image du Vault")):
    """Sert une image citee par son seul nom, ou elle qu'elle soit dans le Vault."""
    found = _guard(_vault().find_asset, ref)
    if found is None or not found.is_file():
        raise HTTPException(status_code=404, detail=f"Image introuvable : {ref}")
    return FileResponse(found)


@router.get("/assets", response_model=list[str])
def get_assets():
    """Toutes les images du Vault, pour les proposer a l'insertion."""
    return _guard(_vault().list_assets)


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
