# Mentaliis

Un second cerveau **spatial**. Pas un gestionnaire de fichiers deguise : un environnement
dans lequel on entre, ou chaque dossier est une **porte** et chaque note un **objet** que
l'on place librement dans l'espace.

- Un **Vault** = un dossier racine reel sur le disque, contenant des `.md` en clair.
- Un **dossier** = une **porte** flottante, avec une image de couverture pour ancrer l'intention.
- Une **note** = une carte deplacable, a laquelle on peut attacher plusieurs images autour.
- Vue globale facon constellation, zoom / pan, positions persistees.

Aucun serveur distant, aucune connexion internet requise : tout est local.

---

## Architecture

```
MENTALIIS/
  src-tauri/    Coquille native (Rust minimal) : la fenetre de l'application
  frontend/     L'univers visuel : portes, canvas, notes, editeur markdown (React + TS)
  engine/       Le moteur Python : Vault, parsing markdown, index, recherche (FastAPI local)
  docs/         Notes de conception et specifications
```

### Comment les morceaux se parlent

Au lancement, l'application demarre **deux processus sur la machine de l'utilisateur** :

1. la **fenetre** (Tauri + webview systeme) qui affiche l'interface ;
2. le **moteur Python**, invisible, qui gere les fichiers et la logique.

Ils communiquent en HTTP **sur `127.0.0.1` uniquement** (localhost = cette machine, et
personne d'autre). Rien ne sort de l'ordinateur, l'application fonctionne hors ligne.
Le moteur s'eteint automatiquement avec la fenetre.

---

## Stack

| Couche   | Techno |
|----------|--------|
| Fenetre native / packaging | Tauri 2 (Windows, macOS, Linux) |
| Interface  | React + TypeScript + Vite |
| Canvas spatial | DOM + transform CSS (entierement restylable en CSS) |
| Editeur markdown | CodeMirror 6 |
| Moteur | Python 3.11+ / FastAPI / Uvicorn |
| Stockage | Fichiers `.md` en clair + `.mentaliis/` (layout, cache) |

---

## Prerequis

- **Node.js** 18+
- **Python** 3.11+
- **Rust** (pour Tauri) : https://rustup.rs
- Windows : [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (deja present sur Windows 10/11 a jour)

## Demarrage rapide (developpement)

Deux terminaux.

**1. Le moteur Python**

```bash
cd engine
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -e ".[dev]"
python -m mentaliis_engine.main
```

Le moteur ecoute sur `http://127.0.0.1:8756`.
Documentation interactive de l'API : `http://127.0.0.1:8756/docs`

**2. L'interface**

```bash
cd frontend
npm install
npm run dev
```

Puis ouvrir l'URL affichee, ou lancer la vraie fenetre native :

```bash
cd frontend
npm run tauri dev
```

---

## Etat du projet

Squelette initial. Ce qui fonctionne deja :

- lecture d'un Vault (dossiers -> portes, `.md` -> notes) ;
- lecture / ecriture du contenu d'une note ;
- persistance des positions spatiales dans `.mentaliis/layout.json` ;
- canvas pan / zoom, portes et notes deplacables ;
- editeur markdown avec apercu.

A venir : liens `[[wikilink]]` et backlinks, recherche plein texte, images attachees,
images de couverture des portes, tags et proprietes, vue constellation globale.
