# Mentaliis sur macOS

Tout est deja configure. Ce document explique quoi lancer, et surtout les trois
pieges qui n'existent pas sous Windows.

## D'abord : on ne construit pas macOS depuis Windows

Il n'existe pas de compilation croisee realiste pour Tauri, et le moteur Python
fige par PyInstaller doit l'etre sur le systeme qui l'executera. Il vous faut
donc un Mac — le votre, ou une machine `macos-latest` chez GitHub Actions, qui
est gratuite pour un depot public.

## Preparer le Mac, une fois

```bash
# Les outils de compilation d'Apple
xcode-select --install

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node 20 ou plus, et Python 3.11 ou plus (Homebrew fait les deux)
brew install node python@3.12

# Le depot
git clone https://github.com/Mentaliis/mentaliis.md.git
cd mentaliis.md
npm install
cd frontend && npm install && cd ..

# L'environnement du moteur
python3 -m venv engine/.venv
engine/.venv/bin/pip install -e 'engine[dev]'
```

## Construire

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mentaliis-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run build
```

Vous obtenez, sous `src-tauri/target/release/bundle/` :

- `macos/Mentaliis.app` — l'application
- `dmg/Mentaliis_<version>_aarch64.dmg` — l'image disque, avec son fond dessine
  et ses deux icones placees de part et d'autre de la fleche
- `macos/Mentaliis.app.tar.gz` et son `.sig` — ce que lit la mise a jour

## Les trois pieges

### 1. L'architecture n'est pas negociable

Le moteur Python est fige pour **une** architecture. Un paquet construit sur un
Mac Apple Silicon ne demarre pas sur un Mac Intel, et inversement. Il n'existe
pas de version « universelle » simple, parce qu'il faudrait un Python lui-meme
universel.

`npm run manifest` en tient compte : il n'annonce que l'architecture de la
machine qui construit. Pour couvrir les deux, construisez sur les deux, puis
rapportez le second `latest.json` a cote du premier — le script fusionne ce
qu'il trouve deja au lieu de l'ecraser.

### 2. Sans compte Apple Developer, Gatekeeper se met en travers

C'est votre choix, et il est parfaitement tenable — mais voici ce qu'il implique.

L'application est signee **ad hoc** (`"signingIdentity": "-"` dans la
configuration). Ce n'est pas un certificat : c'est une signature locale, sans
autorite. Elle est neanmoins **indispensable** sur les Mac Apple Silicon, ou un
binaire `arm64` non signe refuse purement et simplement de se lancer.

Ce qu'un utilisateur verra en telechargeant le `.dmg` :

> « Mentaliis » ne peut pas etre ouvert, car Apple ne peut pas verifier que ce
> logiciel ne contient pas de programme malveillant.

Deux facons de passer outre, a indiquer dans vos notes de publication :

- **clic droit sur l'application → Ouvrir**, puis confirmer. Une seule fois.
- ou, en une commande :
  ```bash
  xattr -dr com.apple.quarantine /Applications/Mentaliis.app
  ```

Sur votre propre Mac, ou l'application ne vient pas d'Internet, rien de tout
cela ne se produit : elle s'ouvre directement.

Le jour ou vous prendrez un compte Apple Developer (99 $/an), il suffira de
remplacer `"signingIdentity": "-"` par le nom de votre certificat et d'ajouter
la notarisation. Rien d'autre ne changera.

### 3. Le droit d'execution du moteur

Le moteur voyage dans `Contents/Resources/engine/`. S'il arrivait qu'il perde
son droit d'execution en chemin, l'application s'ouvrirait sur « Moteur
introuvable ». A verifier au premier paquet :

```bash
ls -l "src-tauri/target/release/bundle/macos/Mentaliis.app/Contents/Resources/engine/mentaliis-engine"
```

La premiere colonne doit contenir des `x`. Sinon :

```bash
chmod +x "…/Contents/Resources/engine/mentaliis-engine"
```

## Publier

Comme sous Windows, avec les fichiers du Mac :

```bash
npm run manifest "Ce qui change."
gh release create v<version> \
  src-tauri/target/release/bundle/latest.json \
  src-tauri/target/release/bundle/dmg/Mentaliis_<version>_aarch64.dmg \
  src-tauri/target/release/bundle/macos/Mentaliis.app.tar.gz \
  src-tauri/target/release/bundle/macos/Mentaliis.app.tar.gz.sig \
  --title "Mentaliis <version>" --notes "…"
```

Le `.app.tar.gz` et sa signature sont ce que la mise a jour automatique va
chercher ; le `.dmg` est ce qu'un nouveau venu telecharge.

## Ce qui a deja ete regle pour vous

- Version minimale : macOS 11 (Big Sur), Intel et Apple Silicon
- Signature ad hoc, pour que l'application demarre sur Apple Silicon
- Fond du `.dmg` dessine aux couleurs de Mentaliis, avec la fleche vers
  Applications et les deux icones placees
- Le moteur embarque dans les ressources, et lance depuis la
- La mise a jour automatique, la meme que sous Windows
