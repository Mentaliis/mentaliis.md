/**
 * Rend les [[wikilinks]] cliquables dans l'apercu.
 *
 * Markdown ne connait pas cette syntaxe : on l'ajoute comme regle d'analyse,
 * plutot que de remplacer du texte a l'aveugle — ainsi un [[lien]] ecrit dans
 * un bloc de code reste du code.
 */

import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

const OPEN = 0x5b; /* [ */

export function wikilinks(md: MarkdownIt): void {
  md.inline.ruler.before("link", "wikilink", (state: StateInline, silent: boolean) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== OPEN || state.src.charCodeAt(start + 1) !== OPEN) {
      return false;
    }

    const end = state.src.indexOf("]]", start + 2);
    if (end === -1 || end > state.posMax) return false;

    const inner = state.src.slice(start + 2, end);
    if (!inner || inner.includes("[")) return false;

    // [[Cible|texte affiche]] et [[Cible#ancre]] sont acceptes.
    const [rawTarget, alias] = inner.split("|");
    const target = rawTarget.split("#")[0].trim();
    if (!target) return false;

    if (!silent) {
      const open = state.push("link_open", "a", 1);
      open.attrs = [
        ["class", "wikilink"],
        ["href", "#"],
        ["data-target", target],
      ];
      const text = state.push("text", "", 0);
      text.content = (alias ?? rawTarget).trim();
      state.push("link_close", "a", -1);
    }

    state.pos = end + 2;
    return true;
  });
}
