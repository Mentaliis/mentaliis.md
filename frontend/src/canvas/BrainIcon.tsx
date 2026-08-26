/**
 * Le cerveau : l'autre apparence possible d'un dossier, au choix avec la porte.
 *
 * Dessine a la main plutot qu'importe comme image : il reste net a n'importe
 * quel zoom, suit le theme et se colore au survol. Les roses vont du plus clair
 * en haut a gauche, ou tombe la lumiere, au plus sombre vers l'arriere.
 */

interface Props {
  /** Les degrades sont nommes par porte : deux cerveaux ne doivent pas se les partager. */
  id: string;
}

export function BrainIcon({ id }: Props) {
  const masse = `masse-${id}`;
  const cervelet = `cervelet-${id}`;
  const tronc = `tronc-${id}`;

  return (
    <svg className="brain" viewBox="0 0 128 118" role="img" aria-label="Cerveau">
      <defs>
        <radialGradient id={masse} cx="38%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffd9e8" />
          <stop offset="38%" stopColor="#f79ec2" />
          <stop offset="78%" stopColor="#d9739f" />
          <stop offset="100%" stopColor="#a84973" />
        </radialGradient>
        <radialGradient id={cervelet} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e08cae" />
          <stop offset="100%" stopColor="#943d64" />
        </radialGradient>
        <linearGradient id={tronc} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b05c85" />
          <stop offset="100%" stopColor="#6e2848" />
        </linearGradient>
      </defs>

      {/* Tronc et cervelet passent dessous : la masse les recouvre en partie,
          ce qui les rattache au lieu de les laisser flotter. */}
      <path fill={`url(#${tronc})`} d="M63 80 C67 92, 66 102, 62 108 C73 106, 80 96, 82 82 Z" />
      <path
        fill={`url(#${cervelet})`}
        d="M76 76 C95 71, 113 80, 111 95 C109 109, 87 112, 79 101 C73 93, 71 81, 76 76 Z"
      />

      {/* La masse : front a gauche, occiput a droite, lobe temporal en dessous. */}
      <path
        className="brain__mass"
        fill={`url(#${masse})`}
        d="M14 56
           C11 39, 24 24, 40 25
           C46 12, 67 7, 79 18
           C95 9, 113 18, 114 35
           C127 43, 125 63, 110 69
           C112 81, 102 89, 90 87
           C84 93, 74 93, 68 89
           C60 95, 47 97, 39 90
           C27 91, 17 82, 19 70
           C14 67, 12 61, 14 56 Z"
      />

      {/* Les circonvolutions : de longs sillons qui suivent la courbure. */}
      <g
        className="brain__folds"
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 35 C48 31, 56 41, 50 53 C46 61, 52 69, 62 69" />
        <path d="M63 21 C61 33, 69 39, 63 49 C57 57, 63 65, 73 65" />
        <path d="M89 19 C87 31, 95 37, 89 47 C83 55, 89 63, 99 63" />
        <path d="M108 35 C102 43, 106 53, 100 59" />
        <path d="M22 51 C30 49, 36 55, 34 63 C32 71, 38 77, 46 77" />
        <path d="M24 71 C30 73, 34 79, 32 85" />
        <path d="M50 79 C58 77, 64 81, 64 87" />
      </g>

      {/* Les plis du cervelet, plus serres : c'est sa signature. */}
      <g className="brain__grooves" fill="none" strokeWidth="2.4" strokeLinecap="round">
        <path d="M83 82 C91 79, 101 81, 106 86" />
        <path d="M82 91 C90 88, 100 90, 106 94" />
        <path d="M84 100 C91 97, 99 99, 104 102" />
      </g>
    </svg>
  );
}
