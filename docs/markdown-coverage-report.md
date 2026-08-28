# Couverture markdown de Mentaliis

Etabli en lisant les quatre specifications de `DRAFTS/MDSPECS/` : les trois
pages du *Markdown Guide* (Basic, Extended, Hacks) et la specification
CommonMark.

## Une precision d'architecture, avant le tableau

Le cahier des charges supposait que le moteur Python analysait le markdown avec
`markdown-it-py`. **Ce n'est pas le cas, et c'est volontaire.**

`engine/` ne rend jamais de HTML. Il ne lit dans un `.md` que quatre choses, par
expressions regulieres : le titre de tete, les tags, les `[[wikilinks]]` et un
extrait pour la carte. Le fichier lui-meme est servi tel quel.

L'analyseur qui compte est donc **celui de l'editeur** : Lezer markdown, embarque
par `@codemirror/lang-markdown`. Il couvre CommonMark et GFM, et se laisse
etendre. C'est la que se joue tout ce qui suit — et c'est aussi ce qui permet
l'apercu vivant, ou l'on voit le resultat sans jamais voir le code.

Consequence pratique : ajouter une syntaxe ne demande rien cote Python. Le
moteur n'a pas d'opinion sur le contenu d'une note.

---

## Syntaxe de base (CommonMark)

| Fonctionnalite | Syntaxe | Analyseur | Editeur : rendu et raccourci |
|---|---|---|---|
| Titres | `# ` a `###### ` | oui | rendu · <kbd>Ctrl+Maj+1/2/3</kbd> |
| Titres alternatifs | `===` / `---` dessous | oui | rendu |
| Paragraphes | ligne vide | oui | rendu |
| Retour a la ligne | deux espaces, ou `\` | oui | rendu |
| Gras | `**texte**`, `__texte__` | oui | rendu · <kbd>Ctrl+B</kbd> |
| Italique | `*texte*`, `_texte_` | oui | rendu · <kbd>Ctrl+I</kbd> |
| Gras et italique | `***texte***` | oui | rendu |
| Citation | `> ` | oui | rendu · <kbd>Ctrl+Maj+Q</kbd> |
| Citation imbriquee | `>> ` | oui | rendu |
| Liste numerotee | `1. ` | oui | rendu · <kbd>Ctrl+Maj+7</kbd> |
| Liste a puces | `- `, `* `, `+ ` | oui | rendu · <kbd>Ctrl+Maj+9</kbd> |
| Listes imbriquees | indentation | oui | rendu · <kbd>Tab</kbd> / <kbd>Maj+Tab</kbd> |
| Code en ligne | `` `texte` `` | oui | rendu · <kbd>Ctrl+E</kbd> |
| Bloc de code indente | 4 espaces | oui | rendu |
| Filet horizontal | `---`, `***`, `___` | oui | rendu · <kbd>Ctrl+Maj+M</kbd> |
| Lien | `[texte](url)` | oui | rendu · <kbd>Ctrl+Maj+K</kbd> |
| Titre de lien | `[t](u "titre")` | oui | rendu |
| Lien automatique | `<https://…>` | oui | rendu |
| Lien par reference | `[t][1]` + `[1]: url` | oui | reconnu, non stylise |
| Image | `![alt](chemin)` | oui | rendue en vignette |
| Image cliquable | `[![alt](i)](url)` | oui | image rendue, lien non suivi |
| Echappements | `\*`, `\_`… | oui | rendu |
| HTML brut | `<em>`, `<div>`… | reconnu | **non rendu, a dessein** |

Le HTML n'est pas interprete. Mentaliis affiche des notes, pas des pages web, et
executer du balisage venu d'un fichier ouvrirait une porte qu'on ne saurait plus
refermer. Le texte reste visible tel qu'il est ecrit.

## Syntaxe etendue

| Fonctionnalite | Syntaxe | Analyseur | Editeur : rendu et raccourci |
|---|---|---|---|
| Tableaux | `\| a \| b \|` | oui (GFM) | rendu, cellules modifiables |
| Bloc clos | ```` ``` ```` | oui | rendu, sans montrer les accents |
| Coloration syntaxique | ```` ```python ```` | oui | 144 langages, pastille de choix |
| Texte barre | `~~texte~~` | oui (GFM) | rendu · <kbd>Ctrl+Maj+S</kbd> |
| Cases a cocher | `- [ ] ` | oui (GFM) | rendu · <kbd>Ctrl+Maj+6</kbd> |
| Lien d'URL automatique | `https://…` | oui (GFM) | rendu |
| **Surlignage** | `==texte==` | **ajoute** | rendu · <kbd>Ctrl+Maj+H</kbd> |
| **Exposant** | `^2^` | **ajoute** | rendu |
| **Indice** | `~2~` | **ajoute** | rendu |
| **Emoji** | `:joy:` | **ajoute** | reconnu ; le glyphe reste a poser |
| Notes de bas de page | `[^1]` | non | **manquant** |
| Identifiants de titre | `### T {#id}` | non | **manquant** |
| Listes de definitions | `Terme` / `: def` | non | **manquant** |

### Les extensions hors specification

Trois des syntaxes ci-dessus **ne figurent ni dans CommonMark ni dans GFM**. Le
*Markdown Guide* les documente comme des conventions repandues, que chaque
application implemente a sa facon.

- **`==surlignage==`** — convention d'Obsidian, Pandoc et MultiMarkdown. Ecrite
  a la main dans `frontend/src/editor/syntaxes.ts`.
- **`^exposant^`** et **`~indice~`** — memes reserves. Le guide previent
  d'ailleurs qu'un tilde unique sert au barre dans certaines applications.

Un fichier qui les emploie reste lisible partout : les autres editeurs
afficheront simplement les signes au lieu de les interpreter. Rien n'est perdu,
rien n'est illisible.

## Contournements documentes comme tels

Le guide consacre une page entiere aux « hacks » : souligner, centrer, colorer,
commenter, dimensionner une image, legender, viser un nouvel onglet, dresser un
sommaire, integrer une video. **Tous passent par du HTML brut**, que Mentaliis
n'interprete pas.

Deux d'entre eux ont ete traites autrement, en restant dans le markdown :

- **Les medias** — image, video, audio, fichier — s'inserent par le menu « + »
  et s'affichent nativement, sans balise HTML.
- **Le souligne** existe dans la barre de mise en forme de Notion. Il n'a **pas**
  d'equivalent markdown : Notion le stocke dans son format propre. Il n'a donc
  pas ete ajoute — l'ecrire demanderait `<ins>`, donc du HTML, donc un fichier
  qui ne s'ouvre plus correctement ailleurs. Le surlignage joue le meme role
  sans ce prix.

## Propre a Mentaliis

| Fonctionnalite | Syntaxe | Etat |
|---|---|---|
| Lien entre notes | `[[Nom de la note]]` | rendu, suivi au clic, retroliens |
| Formule en ligne | `$x^2$` | rendue · <kbd>Ctrl+Maj+E</kbd> |
| Formule en bloc | `$$…$$` | rendue |
| Frontmatter | `---` en tete | lu par le moteur, masque a l'ecran |

Les `[[wikilinks]]` et les formules `$…$` sont eux aussi hors CommonMark. Le
premier vient d'Obsidian, le second de Pandoc et de la plupart des editeurs
scientifiques.

---

## Ce qui reste a faire

Trois elements de la syntaxe etendue manquent encore. Aucun n'est bloquant, et
tous demandent un analyseur ecrit a la main — Lezer n'en propose pas.

**Notes de bas de page** (`[^1]` et `[^1]: texte`). La plus utile des trois.
Elle demande deux analyseurs : un pour l'appel en ligne, un pour la definition
en bloc, plus une numerotation calculee a l'affichage et un renvoi cliquable
dans les deux sens. Un travail a part entiere.

**Identifiants de titre** (`### Titre {#ancre}`). Utile surtout pour un sommaire
interne. Peu de sens tant qu'une note ne se publie pas en page web.

**Listes de definitions** (`Terme` puis `: definition`). Rare, et son analyse
entre en conflit avec les listes ordinaires — le guide lui-meme la donne comme
peu repandue.

**Le glyphe des emoji.** L'analyseur reconnait `:joy:`, et une table de vingt
raccourcis courants existe dans `syntaxes.ts`, mais le remplacement a l'ecran
n'est pas branche. Le guide recommande de toute facon de coller l'emoji
directement, ce qui fonctionne deja.

---

*Rapport etabli le 28 aout 2026, pour Mentaliis 0.1.13.*
