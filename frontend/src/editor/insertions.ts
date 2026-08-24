/** Ce que le bouton « + » sait inserer dans une note. */

export interface Insertion {
  label: string;
  /** Texte insere. `|` marque ou placer le curseur ensuite. */
  snippet: string;
  /** Doit commencer sur une ligne vide. */
  block?: boolean;
  hint?: string;
}

export interface InsertGroup {
  name: string;
  items: Insertion[];
}

export const INSERT_GROUPS: InsertGroup[] = [
  {
    name: "Structure",
    items: [
      { label: "Titre 1", snippet: "# |", block: true },
      { label: "Titre 2", snippet: "## |", block: true },
      { label: "Titre 3", snippet: "### |", block: true },
      { label: "Separateur", snippet: "---\n|", block: true },
      { label: "Citation", snippet: "> |", block: true },
      { label: "Bloc de code", snippet: "```\n|\n```", block: true },
    ],
  },
  {
    name: "Listes",
    items: [
      { label: "Liste a puces", snippet: "- |", block: true },
      { label: "Liste numerotee", snippet: "1. |", block: true },
      { label: "Case a cocher", snippet: "- [ ] |", block: true },
      {
        label: "Tableau",
        snippet: "| Colonne | Colonne |\n| --- | --- |\n| | |",
        block: true,
      },
    ],
  },
  {
    name: "Mise en forme",
    items: [
      { label: "Gras", snippet: "**|**" },
      { label: "Italique", snippet: "*|*" },
      { label: "Barre", snippet: "~~|~~" },
      { label: "Code", snippet: "`|`" },
      { label: "Lien vers une note", snippet: "[[|]]" },
      { label: "Lien web", snippet: "[|](https://)" },
    ],
  },
  {
    name: "Mathematiques",
    items: [
      { label: "Formule en ligne", snippet: "$|$" },
      { label: "Formule en bloc", snippet: "$$\n|\n$$", block: true },
      { label: "Fraction", snippet: "$\\frac{|}{}$" },
      { label: "Racine", snippet: "$\\sqrt{|}$" },
      { label: "Puissance", snippet: "$x^{|}$" },
      { label: "Indice", snippet: "$x_{|}$" },
      { label: "Somme", snippet: "$\\sum_{i=1}^{n} |$" },
      { label: "Integrale", snippet: "$\\int_{a}^{b} |$" },
      { label: "Limite", snippet: "$\\lim_{x \\to 0} |$" },
      { label: "Matrice", snippet: "$$\\begin{pmatrix} | & \\\\ & \\end{pmatrix}$$", block: true },
    ],
  },
];

/** Symboles inseres tels quels, en un clic. */
export interface SymbolGroup {
  name: string;
  symbols: { glyph: string; latex: string; name: string }[];
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
