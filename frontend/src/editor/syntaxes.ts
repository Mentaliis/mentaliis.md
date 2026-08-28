/**
 * Les syntaxes que CommonMark ne couvre pas.
 *
 * L'analyseur de CodeMirror comprend deja CommonMark et GFM — titres, listes,
 * tableaux, cases a cocher, texte barre, liens automatiques. Il manque quelques
 * elements decrits par le guide markdown comme « etendus », que plusieurs
 * applications reconnaissent sans qu'aucune specification ne les impose.
 *
 * Trois viennent de l'analyseur lui-meme : l'exposant, l'indice, les emoji.
 * Le surlignage, lui, n'existe nulle part en standard : on l'ecrit ici, en
 * suivant la convention la plus repandue — celle d'Obsidian et de Pandoc.
 * Elle est documentee comme telle dans `docs/markdown-coverage-report.md`.
 */

import { Emoji, Subscript, Superscript } from "@lezer/markdown";
import type { MarkdownConfig } from "@lezer/markdown";
import { Tag, styleTags } from "@lezer/highlight";

/** Une etiquette a nous, pour peindre le surlignage. */
export const surlignageTag = Tag.define();

const SIGNE_EGAL = 61; /* = */

/**
 * Le surlignage : `==texte==`.
 *
 * Hors CommonMark et hors GFM. Obsidian, Pandoc et MultiMarkdown l'ecrivent
 * ainsi, et le guide markdown le documente comme la convention courante ; on
 * s'y tient plutot que d'inventer une syntaxe qu'aucun autre editeur ne
 * saurait relire.
 */
export const Surlignage: MarkdownConfig = {
  defineNodes: [
    { name: "Surlignage", style: surlignageTag },
    { name: "SurlignageMark", style: undefined },
  ],
  parseInline: [
    {
      name: "Surlignage",
      before: "Emphasis",
      parse(cx, next, pos) {
        // Il faut deux signes egal colles pour ouvrir ou fermer.
        if (next !== SIGNE_EGAL || cx.char(pos + 1) !== SIGNE_EGAL) return -1;
        return cx.addDelimiter(marqueurSurlignage, pos, pos + 2, true, true);
      },
    },
  ],
};

const marqueurSurlignage = { resolve: "Surlignage", mark: "SurlignageMark" };

/**
 * Ce qu'on ajoute a l'analyseur markdown.
 *
 * L'ordre importe peu : chaque element declare ou il s'insere.
 */
export const syntaxesEtendues: MarkdownConfig[] = [
  Surlignage,
  Superscript,
  Subscript,
  Emoji,
];

/** Les etiquettes des elements ajoutes, pour que le theme puisse les peindre. */
export const etiquettesEtendues = styleTags({});

/**
 * Les raccourcis d'emoji les plus courants.
 *
 * Le guide markdown rappelle qu'ils varient d'une application a l'autre : il
 * n'existe pas de liste officielle. On en couvre une poignee, celle qui revient
 * partout, et le reste s'ecrit en collant l'emoji directement — ce que le
 * guide recommande d'ailleurs en premier.
 */
export const EMOJI: Record<string, string> = {
  ":smile:": "😄",
  ":joy:": "😂",
  ":heart:": "❤️",
  ":+1:": "👍",
  ":-1:": "👎",
  ":tada:": "🎉",
  ":fire:": "🔥",
  ":star:": "⭐",
  ":warning:": "⚠️",
  ":bulb:": "💡",
  ":memo:": "📝",
  ":rocket:": "🚀",
  ":tent:": "⛺",
  ":eyes:": "👀",
  ":check:": "✅",
  ":x:": "❌",
  ":brain:": "🧠",
  ":books:": "📚",
  ":pushpin:": "📌",
  ":thinking:": "🤔",
};
