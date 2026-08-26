/**
 * Les petites icones du menu d'insertion.
 *
 * Dessinees a la main plutot qu'importees : une police d'icones entiere pour une
 * quinzaine de traits serait du poids pour rien, et celles-ci suivent le theme.
 */

const TRAITS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <svg className="insert__icon" viewBox="0 0 20 20" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Un « H » suivi de son niveau en indice, comme dans les traitements de texte. */
function Titre({ niveau }: { niveau: number }) {
  return (
    <svg className="insert__icon" viewBox="0 0 20 20" aria-hidden="true">
      <text x="1" y="15" className="insert__icon-letter">
        H
      </text>
      <text x="12" y="17" className="insert__icon-level">
        {niveau}
      </text>
    </svg>
  );
}

const lignes = (ys: number[], x1 = 8, x2 = 17) =>
  ys.map((y) => <path key={y} d={`M${x1} ${y}H${x2}`} {...TRAITS} />);

export const ICONS: Record<string, React.ReactNode> = {
  texte: (
    <Cadre>
      <path d="M4 5h12M10 5v10M7 15h6" {...TRAITS} />
    </Cadre>
  ),
  h1: <Titre niveau={1} />,
  h2: <Titre niveau={2} />,
  h3: <Titre niveau={3} />,
  h4: <Titre niveau={4} />,
  puces: (
    <Cadre>
      {lignes([6, 10, 14])}
      <circle cx="4" cy="6" r="1.4" fill="currentColor" />
      <circle cx="4" cy="10" r="1.4" fill="currentColor" />
      <circle cx="4" cy="14" r="1.4" fill="currentColor" />
    </Cadre>
  ),
  numeros: (
    <Cadre>
      {lignes([6, 10, 14])}
      <text x="1" y="8" className="insert__icon-tiny">
        1
      </text>
      <text x="1" y="12.5" className="insert__icon-tiny">
        2
      </text>
      <text x="1" y="17" className="insert__icon-tiny">
        3
      </text>
    </Cadre>
  ),
  taches: (
    <Cadre>
      {lignes([6, 13])}
      <rect x="2" y="3.5" width="5" height="5" rx="1" {...TRAITS} />
      <rect x="2" y="10.5" width="5" height="5" rx="1" {...TRAITS} />
      <path d="M3.2 13l1.2 1.2 2.1-2.4" {...TRAITS} />
    </Cadre>
  ),
  citation: (
    <Cadre>
      <path d="M4 4v12" {...TRAITS} strokeWidth={2} />
      {lignes([7, 11, 15], 8, 16)}
    </Cadre>
  ),
  separateur: (
    <Cadre>
      <path d="M2 10h16" {...TRAITS} />
    </Cadre>
  ),
  tableau: (
    <Cadre>
      <rect x="2.5" y="4" width="15" height="12" rx="1" {...TRAITS} />
      <path d="M2.5 8h15M7.5 8v8M12.5 8v8" {...TRAITS} />
    </Cadre>
  ),
  image: (
    <Cadre>
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" {...TRAITS} />
      <circle cx="7" cy="8" r="1.4" {...TRAITS} />
      <path d="M3.5 14l4-4 3.5 3.5L14 11l3 3" {...TRAITS} />
    </Cadre>
  ),
  video: (
    <Cadre>
      <rect x="2" y="5" width="11" height="10" rx="1.5" {...TRAITS} />
      <path d="M13 9.5l5-2.5v6l-5-2.5z" {...TRAITS} />
    </Cadre>
  ),
  audio: (
    <Cadre>
      <path d="M3 8v4h3l4 3V5L6 8H3z" {...TRAITS} />
      <path d="M13 7.5a4 4 0 0 1 0 5M15.5 5.5a7 7 0 0 1 0 9" {...TRAITS} />
    </Cadre>
  ),
  code: (
    <Cadre>
      <path d="M7 6l-4 4 4 4M13 6l4 4-4 4" {...TRAITS} />
    </Cadre>
  ),
  fichier: (
    <Cadre>
      <path d="M5 2.5h6l4 4v11H5z" {...TRAITS} />
      <path d="M11 2.5v4h4" {...TRAITS} />
    </Cadre>
  ),
  gras: (
    <Cadre>
      <text x="4" y="15" className="insert__icon-letter" style={{ fontWeight: 800 }}>
        B
      </text>
    </Cadre>
  ),
  italique: (
    <Cadre>
      <text x="5" y="15" className="insert__icon-letter" style={{ fontStyle: "italic" }}>
        I
      </text>
    </Cadre>
  ),
  barre: (
    <Cadre>
      <text x="4" y="15" className="insert__icon-letter">
        S
      </text>
      <path d="M3 10h14" {...TRAITS} />
    </Cadre>
  ),
  lien: (
    <Cadre>
      <path d="M8 12a3 3 0 0 1 0-4l2-2a3 3 0 0 1 4 4l-1 1" {...TRAITS} />
      <path d="M12 8a3 3 0 0 1 0 4l-2 2a3 3 0 0 1-4-4l1-1" {...TRAITS} />
    </Cadre>
  ),
  note: (
    <Cadre>
      <rect x="3" y="3" width="14" height="14" rx="2" {...TRAITS} />
      <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4" {...TRAITS} />
    </Cadre>
  ),
  formule: (
    <Cadre>
      <path d="M4 16c2 0 2-12 5-12M3 9h7" {...TRAITS} />
      <path d="M12 8l5 6M17 8l-5 6" {...TRAITS} />
    </Cadre>
  ),
};
