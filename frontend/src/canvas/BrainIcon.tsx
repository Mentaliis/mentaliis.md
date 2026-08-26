/**
 * Le cerveau : l'autre apparence possible d'un dossier, au choix avec la porte.
 *
 * Il est deux fois plus grand qu'une porte, volontairement : c'est le symbole de
 * ce qui fait fonctionner le reste, il doit dominer la scene.
 *
 * Dessine a la main plutot qu'importe comme image : il reste net a n'importe
 * quel zoom, suit le theme et se colore au survol.
 */

interface Props {
  /** Les degrades sont nommes par porte : deux cerveaux ne doivent pas se les partager. */
  id: string;
}

export function BrainIcon({ id }: Props) {
  const chair = `chair-${id}`;
  const clair = `clair-${id}`;

  return (
    <svg className="brain" viewBox="0 0 200 182" role="img" aria-label="Cerveau">
      <defs>
        <linearGradient id={chair} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#ffb8c1" />
          <stop offset="50%" stopColor="#fb8b99" />
          <stop offset="100%" stopColor="#f26576" />
        </linearGradient>
        <linearGradient id={clair} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd2d8" />
          <stop offset="100%" stopColor="#ffb0bb" />
        </linearGradient>
      </defs>

      <g
        className="brain__ink"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tronc cerebral : un moignon court et epais. */}
        <path fill="#f26576" d="M104 126 C107 144, 107 158, 105 170 C125 170, 135 150, 137 126 Z" />

        {/* Cervelet, glisse sous l'occiput, avec ses stries serrees. */}
        <path
          fill="#fb8b99"
          d="M126 114 C150 104, 177 115, 177 137 C177 158, 149 166, 134 150 C123 137, 119 120, 126 114 Z"
        />
        <g className="brain__stries" strokeWidth="1.7" fill="none">
          <path d="M130 122 C146 114, 164 117, 174 128" />
          <path d="M128 131 C145 123, 165 127, 176 138" />
          <path d="M130 141 C147 133, 166 137, 175 147" />
          <path d="M136 151 C150 143, 165 146, 171 153" />
        </g>

        {/* La masse : un contour bosselé, comme des lobes accoles. */}
        <path
          className="brain__mass"
          fill={`url(#${chair})`}
          d="M24 92
             C16 74, 16 55, 31 44
             C35 29, 51 23, 63 28
             C69 13, 89 7, 103 16
             C117 5, 139 9, 147 24
             C165 20, 183 34, 182 53
             C195 63, 194 85, 180 95
             C182 109, 172 121, 158 120
             C152 133, 138 139, 126 134
             C112 147, 84 151, 62 141
             C40 132, 26 112, 24 92 Z"
        />

        {/* Le lobe temporal : un vrai lobe pose sous la scissure de Sylvius. */}
        <path
          fill="#f57787"
          d="M29 97
             C44 122, 77 138, 109 136
             C127 135, 139 128, 146 116
             C144 132, 130 145, 110 150
             C81 156, 49 143, 33 121
             C27 112, 26 101, 29 97 Z"
        />
        <path fill="none" strokeWidth="2.2" opacity="0.8" d="M45 122 C66 135, 94 141, 118 136" />

        {/* Circonvolutions : de longs sillons qui serpentent d'un bord a l'autre. */}
        <g fill="none">
          <path d="M40 52 C55 43, 67 52, 62 67 C58 79, 67 89, 79 86" />
          <path d="M75 31 C70 47, 83 53, 78 67 C74 80, 84 90, 97 85" />
          <path d="M109 23 C104 40, 117 46, 112 61 C108 75, 119 85, 133 80" />
          <path d="M143 29 C138 46, 151 52, 146 67 C142 80, 152 90, 165 84" />
          <path d="M173 47 C182 58, 179 75, 168 81" />
          <path d="M27 73 C40 66, 51 75, 48 89" />
          <path d="M57 96 C69 92, 78 100, 76 110" />
          <path d="M96 96 C108 92, 117 100, 115 111" />
        </g>

        {/* Reflets : la lumiere tombe en haut a gauche. */}
        <g stroke="none" fill={`url(#${clair})`} opacity="0.5">
          <path d="M40 46 C52 32, 74 24, 94 27 C74 33, 56 43, 45 56 Z" />
          <path d="M120 18 C142 15, 162 26, 170 42 C157 30, 139 23, 120 23 Z" />
        </g>
        <g className="brain__reflets" strokeWidth="2.4" fill="none">
          <path d="M46 41 C60 32, 76 28, 92 30" />
          <path d="M124 17 C142 16, 157 24, 166 37" />
        </g>
      </g>
    </svg>
  );
}
