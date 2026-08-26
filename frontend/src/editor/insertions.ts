/** Ce que le bouton « + » sait inserer dans une note. */

export interface Insertion {
  label: string;
  /** Nom de l'icone affichee devant, cf. `icons.tsx`. */
  icon: string;
  /** Texte insere. `|` marque ou placer le curseur ensuite. */
  snippet: string;
  /** Doit commencer sur une ligne vide. */
  block?: boolean;
  /** Rappel du raccourci markdown, affiche a droite. */
  hint?: string;
  /** Ouvre d'abord la reserve, filtree sur cette famille de medias. */
  media?: "image" | "video" | "audio" | "fichier";
}

export interface InsertGroup {
  name: string;
  items: Insertion[];
}

export const INSERT_GROUPS: InsertGroup[] = [
  {
    name: "Blocs de base",
    items: [
      { label: "Texte", icon: "texte", snippet: "|", block: true },
      { label: "Titre 1", icon: "h1", snippet: "# |", block: true, hint: "#" },
      { label: "Titre 2", icon: "h2", snippet: "## |", block: true, hint: "##" },
      { label: "Titre 3", icon: "h3", snippet: "### |", block: true, hint: "###" },
      { label: "Titre 4", icon: "h4", snippet: "#### |", block: true, hint: "####" },
      { label: "Liste a puces", icon: "puces", snippet: "- |", block: true, hint: "-" },
      { label: "Liste numerotee", icon: "numeros", snippet: "1. |", block: true, hint: "1." },
      { label: "Liste de taches", icon: "taches", snippet: "- [ ] |", block: true, hint: "[]" },
      { label: "Citation", icon: "citation", snippet: "> |", block: true, hint: ">" },
      { label: "Separateur", icon: "separateur", snippet: "---\n|", block: true, hint: "---" },
      {
        label: "Tableau",
        icon: "tableau",
        snippet: "| Colonne | Colonne |\n| --- | --- |\n| | |",
        block: true,
      },
    ],
  },
  {
    name: "Media",
    items: [
      { label: "Image", icon: "image", snippet: "![[|]]", block: true, media: "image" },
      { label: "Video", icon: "video", snippet: "![[|]]", block: true, media: "video" },
      { label: "Audio", icon: "audio", snippet: "![[|]]", block: true, media: "audio" },
      { label: "Code", icon: "code", snippet: "```\n|\n```", block: true, hint: "```" },
      { label: "Fichier", icon: "fichier", snippet: "![[|]]", block: true, media: "fichier" },
    ],
  },
  {
    name: "Mise en forme",
    items: [
      { label: "Gras", icon: "gras", snippet: "**|**" },
      { label: "Italique", icon: "italique", snippet: "*|*" },
      { label: "Barre", icon: "barre", snippet: "~~|~~" },
      { label: "Code en ligne", icon: "code", snippet: "`|`" },
      { label: "Lien vers une note", icon: "note", snippet: "[[|]]", hint: "[[" },
      { label: "Lien web", icon: "lien", snippet: "[|](https://)" },
    ],
  },
  {
    name: "Mathematiques",
    items: [
      { label: "Formule en ligne", icon: "formule", snippet: "$|$" },
      { label: "Formule en bloc", icon: "formule", snippet: "$$\n|\n$$", block: true },
      { label: "Fraction", icon: "formule", snippet: "$\\frac{|}{}$" },
      { label: "Racine", icon: "formule", snippet: "$\\sqrt{|}$" },
      { label: "Puissance", icon: "formule", snippet: "$x^{|}$" },
    ],
  },
];

/** Un symbole mathematique, insere en LaTeX. */
export interface MathSymbol {
  glyph: string;
  latex: string;
  name: string;
}

export interface SymbolGroup {
  name: string;
  symbols: MathSymbol[];
}

export const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    name: "Operations",
    symbols: [
      { glyph: "×", latex: "\\times", name: "multiplie" },
      { glyph: "÷", latex: "\\div", name: "divise" },
      { glyph: "±", latex: "\\pm", name: "plus ou moins" },
      { glyph: "∓", latex: "\\mp", name: "moins ou plus" },
      { glyph: "·", latex: "\\cdot", name: "point" },
      { glyph: "∘", latex: "\\circ", name: "composition" },
    ],
  },
  {
    name: "Relations",
    symbols: [
      { glyph: "≠", latex: "\\neq", name: "different" },
      { glyph: "≈", latex: "\\approx", name: "environ" },
      { glyph: "≡", latex: "\\equiv", name: "identique" },
      { glyph: "≤", latex: "\\leq", name: "inferieur ou egal" },
      { glyph: "≥", latex: "\\geq", name: "superieur ou egal" },
      { glyph: "∝", latex: "\\propto", name: "proportionnel" },
    ],
  },
  {
    name: "Ensembles",
    symbols: [
      { glyph: "∈", latex: "\\in", name: "appartient" },
      { glyph: "∉", latex: "\\notin", name: "n'appartient pas" },
      { glyph: "⊂", latex: "\\subset", name: "inclus" },
      { glyph: "∪", latex: "\\cup", name: "union" },
      { glyph: "∩", latex: "\\cap", name: "intersection" },
      { glyph: "∅", latex: "\\emptyset", name: "ensemble vide" },
      { glyph: "ℝ", latex: "\\mathbb{R}", name: "reels" },
      { glyph: "ℕ", latex: "\\mathbb{N}", name: "entiers naturels" },
      { glyph: "ℤ", latex: "\\mathbb{Z}", name: "entiers relatifs" },
      { glyph: "ℚ", latex: "\\mathbb{Q}", name: "rationnels" },
    ],
  },
  {
    name: "Logique",
    symbols: [
      { glyph: "∀", latex: "\\forall", name: "pour tout" },
      { glyph: "∃", latex: "\\exists", name: "il existe" },
      { glyph: "¬", latex: "\\neg", name: "non" },
      { glyph: "∧", latex: "\\land", name: "et" },
      { glyph: "∨", latex: "\\lor", name: "ou" },
      { glyph: "⇒", latex: "\\Rightarrow", name: "implique" },
      { glyph: "⇔", latex: "\\Leftrightarrow", name: "equivaut" },
      { glyph: "→", latex: "\\to", name: "vers" },
    ],
  },
  {
    name: "Grec",
    symbols: [
      { glyph: "α", latex: "\\alpha", name: "alpha" },
      { glyph: "β", latex: "\\beta", name: "beta" },
      { glyph: "γ", latex: "\\gamma", name: "gamma" },
      { glyph: "δ", latex: "\\delta", name: "delta" },
      { glyph: "θ", latex: "\\theta", name: "theta" },
      { glyph: "λ", latex: "\\lambda", name: "lambda" },
      { glyph: "μ", latex: "\\mu", name: "mu" },
      { glyph: "π", latex: "\\pi", name: "pi" },
      { glyph: "σ", latex: "\\sigma", name: "sigma" },
      { glyph: "φ", latex: "\\varphi", name: "phi" },
      { glyph: "ω", latex: "\\omega", name: "omega" },
      { glyph: "Δ", latex: "\\Delta", name: "Delta" },
      { glyph: "Σ", latex: "\\Sigma", name: "Sigma" },
      { glyph: "Ω", latex: "\\Omega", name: "Omega" },
    ],
  },
  {
    name: "Analyse",
    symbols: [
      { glyph: "∞", latex: "\\infty", name: "infini" },
      { glyph: "∂", latex: "\\partial", name: "derivee partielle" },
      { glyph: "∇", latex: "\\nabla", name: "nabla" },
      { glyph: "∫", latex: "\\int", name: "integrale" },
      { glyph: "∑", latex: "\\sum", name: "somme" },
      { glyph: "∏", latex: "\\prod", name: "produit" },
      { glyph: "√", latex: "\\sqrt{}", name: "racine" },
    ],
  },
];
