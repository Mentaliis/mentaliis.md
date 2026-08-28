/**
 * La coloration du code, dans les blocs de la note.
 *
 * Le texte reste du markdown standard sur le disque : un bloc cloture par trois
 * accents graves, avec le nom du langage juste apres — la « chaine d'info » de
 * CommonMark. Rien n'est invente, rien n'est propre a Mentaliis, et le fichier
 * s'ouvre aussi bien ailleurs.
 *
 * La coloration, elle, ne s'ecrit jamais dans le fichier : elle est recalculee
 * a l'affichage. C'est l'analyseur du langage qui decoupe le texte en mots-cles,
 * chaines, commentaires ; ce module ne fait qu'attribuer une couleur a chacun.
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * Les langages reconnus, tels que CodeMirror les decrit.
 *
 * Chacun n'est charge qu'au moment ou un bloc l'emploie : la note n'emporte
 * pas cent quarante analyseurs pour en utiliser un.
 */
export const langagesConnus = languages;

/** Le nom lisible d'un langage, a partir de ce qui est ecrit apres les accents graves. */
export function nomDuLangage(info: string): string | null {
  const cherche = info.trim().toLowerCase();
  if (!cherche) return null;
  const trouve = languages.find(
    (langage) =>
      langage.name.toLowerCase() === cherche ||
      langage.alias.includes(cherche) ||
      langage.extensions.includes(cherche),
  );
  return trouve ? trouve.name : info.trim();
}

/**
 * Les couleurs du code, dans la palette de Mentaliis.
 *
 * Le bleu de l'application reste reserve a ce qui structure — mots-cles et
 * definitions. Les chaines prennent un vert doux, les nombres un ambre, les
 * commentaires s'effacent : on lit d'abord le sens, ensuite le detail.
 */
const couleurs = HighlightStyle.define([
  { tag: [tags.keyword, tags.moduleKeyword, tags.controlKeyword], color: "#7aa2ff" },
  { tag: [tags.definitionKeyword, tags.modifier], color: "#7aa2ff", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "#9ad19a" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "#e0b070" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#55647f", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#c9a0ff" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: "#e6ecf7" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#6fd0c8" },
  { tag: [tags.propertyName, tags.attributeName], color: "#8fb8f0" },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: "#8b9bb8" },
  { tag: [tags.tagName], color: "#7aa2ff" },
  { tag: [tags.attributeValue], color: "#9ad19a" },
  { tag: [tags.meta, tags.processingInstruction], color: "#8b9bb8" },
  { tag: [tags.invalid], color: "#ff6b6b" },
]);

/**
 * A poser dans l'editeur, une fois.
 *
 * `fallback` laisse le theme de Mentaliis peindre le texte ordinaire : ces
 * couleurs ne concernent que ce que l'analyseur d'un langage a reconnu.
 */
export function colorationDuCode(): Extension {
  return syntaxHighlighting(couleurs, { fallback: false });
}
