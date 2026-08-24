"""Routes du moteur.

Toutes ces routes ne sont joignables que depuis la machine locale.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..models import (
    CreateDoorRequest,
    CreateNoteRequest,
    Door,
    MoveRequest,
    Note,
    NoteSummary,
    OpenVaultRequest,
    RenameRequest,
    SaveNoteRequest,
    SceneResponse,
    SetCoverRequest,
    VaultInfo,
)
from ..vault import VaultError, current_vault, open_vault
from ..vault.vault import last_vault

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
def post_open_vault(payload: OpenVaultRequest) -> VaultInfo:
    return _guard(lambda: open_vault(payload.path).info())


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
