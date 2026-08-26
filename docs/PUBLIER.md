# Publier une version de Mentaliis

Ce document ne concerne que la publication. **Le developpement, lui, n'a pas
change** : `npm run dev` lance toujours Vite et l'interpreteur Python du venv,
avec le rechargement a chaud. Rien de ce qui suit n'a d'effet sur ce quotidien.

## Ce que fait l'empaquetage

Trois pieces se rejoignent :

1. **Le moteur Python** est fige par PyInstaller en un dossier autonome
   (`engine/dist/mentaliis-engine/`). La machine qui recoit Mentaliis n'a pas
   besoin d'avoir Python installe.
2. **L'interface** est compilee par Vite et logee dans le binaire.
3. **La coquille Rust** embarque le moteur dans ses ressources, sous `engine/`,
   et le lance au demarrage — le chemin de production de `src-tauri/src/engine.rs`.

## Publier

### 1. Monter le numero de version

Dans `src-tauri/tauri.conf.json`, le champ `version`. C'est lui que l'updater
compare : sans changement de numero, aucune mise a jour n'est proposee.

### 2. Construire

```bash
# La cle qui signe les mises a jour. Sans elle, les paquets sont produits
# mais ne sont pas signes, et l'updater les refusera.
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mentaliis-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

npm run build
```

`npm run build` fige d'abord le moteur, puis empaquette. Comptez quelques
minutes : la compilation Rust en release est lente, mais elle est mise en cache.

Resultat sous `src-tauri/target/release/bundle/` :

- `nsis/Mentaliis_<version>_x64-setup.exe` — l'installeur
- `nsis/Mentaliis_<version>_x64-setup.exe.sig` — sa signature

### 3. Ecrire le manifeste

```bash
npm run manifest "Ce qui change dans cette version."
```

Cela produit `bundle/latest.json` : le fichier que l'application interroge pour
savoir qu'une version existe, ou la telecharger, et avec quelle signature la
verifier.

### 4. Publier sur GitHub

```bash
gh release create v<version> \
  src-tauri/target/release/bundle/latest.json \
  src-tauri/target/release/bundle/nsis/Mentaliis_<version>_x64-setup.exe \
  --title "Mentaliis <version>" --notes "..."
```

Le `latest.json` doit imperativement etre joint a la publication : l'updater le
lit a l'adresse `releases/latest/download/latest.json`.

## macOS

On ne compile pas un logiciel macOS depuis Windows. Il faut une machine macOS —
la votre, ou une machine d'integration continue. La marche a suivre y est la
meme ; `npm run manifest` reconnait les paquets `.app.tar.gz` et les ajoute au
manifeste a cote de ceux de Windows.

## La cle de signature

Elle vit dans `~/.tauri/mentaliis-updater.key`, **hors du depot**, et le
`.gitignore` refuse tout fichier `.key`.

Sa partie publique est inscrite dans `tauri.conf.json`. Perdre la partie privee
signifie ne plus jamais pouvoir signer de mise a jour pour les installations
existantes : sauvegardez-la ailleurs qu'ici.

Elle n'a pas de mot de passe, ce qui rend les constructions locales simples.
Tant qu'aucune version n'est publiee, en regenerer une avec mot de passe ne
coute rien ; apres publication, cela couperait les mises a jour deja installees.

## La signature du code, qui est autre chose

La signature ci-dessus prouve a Mentaliis que la mise a jour vient bien de vous.
Elle ne dit rien a Windows, qui affichera « Windows a protege votre ordinateur »
au premier lancement d'un installeur non signe. Faire taire cet avertissement
demande un certificat de signature de code achete a une autorite. Sur macOS,
c'est un compte Apple Developer et une notarisation, faute de quoi Gatekeeper
refuse d'ouvrir l'application.
