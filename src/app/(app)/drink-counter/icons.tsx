// Caspers håndtegnede ikoner til genstandstælleren (Affinity-eksport,
// 2026-09-20). Streger er currentColor, så de følger knappens tekstfarve
// i begge temaer. Alle fire shot-glas deler samme 17×26-viewBox — 2 cl-
// glassene (14×21) er vertikalt centreret inde i rammen — så de kan
// renderes med IDENTISK klasse og flugter optisk; størrelsesforholdet er
// geometri, ikke CSS. De stærke varianter har et kryds i glasset.

export function BeerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 13 27"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <g transform="matrix(1,0,0,1,-0.646948,0.2)">
        <g transform="matrix(0.996733,0,0,1.2,-5.13018,-1.4)">
          <path
            d="M10,3C10,2.451 10.451,2 11,2L13,2C13.549,2 14,2.451 14,3L14,5C14,6.298 14.421,7.562 15.2,8.6L15.8,9.4C16.579,10.438 17,11.702 17,13L17,21C17,21.549 16.549,22 16,22L8,22C7.451,22 7,21.549 7,21L7,13C7,11.702 7.421,10.438 8.2,9.4L8.8,8.6C9.579,7.562 10,6.298 10,5L10,3Z"
            stroke="currentColor"
            strokeWidth="2.18"
          />
        </g>
        <g transform="matrix(-0.915142,0,0,0.915142,12.3215,3.68312)">
          <path
            d="M6,18.178C6.807,18.178 7.685,17.709 8.078,17.255C8.663,16.579 8.79,15.162 8.541,13.716C8.334,12.518 7.208,11.354 7.239,11.32C7.782,10.729 7.777,10.556 7.756,10.122C7.735,9.688 7.054,9.027 6,9.089C4.946,9.027 4.265,9.688 4.244,10.122C4.223,10.556 4.218,10.729 4.761,11.32C4.792,11.354 3.666,12.518 3.459,13.716C3.21,15.162 3.337,16.579 3.922,17.255C4.315,17.709 5.193,18.178 6,18.178Z"
            stroke="currentColor"
            strokeWidth="2.19"
            strokeMiterlimit="1.5"
          />
        </g>
      </g>
    </svg>
  );
}

function ShotSvg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 17 26"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// 2 cl-glasset (14×21) centreret i 17×26: x (17-14)/2, y (26-21)/2.
const CENTER_2CL = "translate(1.5,2.5)";

export function Shot2clIcon({ className }: { className?: string }) {
  return (
    <ShotSvg className={className}>
      <g transform={CENTER_2CL}>
        <g transform="matrix(1,0,0,1,-0.366377,-4.10954)">
          <g transform="matrix(1.20787,0,0,1.67689,-0.0751942,-5.60664)">
            <path
              d="M1.193,7.554L2.807,17.721L9.193,17.721L10.807,7.554"
              stroke="currentColor"
              strokeWidth="1.37"
              strokeMiterlimit="1.5"
            />
          </g>
          <g transform="matrix(1.25293,0,0,1.25293,-0.345603,-3.24304)">
            <ellipse
              cx="6"
              cy="8.223"
              rx="4.634"
              ry="1.557"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeMiterlimit="1.5"
            />
          </g>
        </g>
      </g>
    </ShotSvg>
  );
}

export function Shot2clStrongIcon({ className }: { className?: string }) {
  return (
    <ShotSvg className={className}>
      <g transform={CENTER_2CL}>
        <g transform="matrix(1.20787,0,0,1.67689,-0.441571,-9.71619)">
          <path
            d="M1.193,7.554L2.807,17.721L9.193,17.721L10.807,7.554"
            stroke="currentColor"
            strokeWidth="1.37"
            strokeMiterlimit="1.5"
          />
        </g>
        <g transform="matrix(1.25293,0,0,1.25293,-0.71198,-7.35258)">
          <ellipse
            cx="6"
            cy="8.223"
            rx="4.634"
            ry="1.557"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeMiterlimit="1.5"
          />
        </g>
        <path
          d="M4.656,11.318L9.093,11.318"
          stroke="currentColor"
          strokeWidth="2"
        />
        <g transform="matrix(6.12323e-17,1,-1,6.12323e-17,18.1929,4.44367)">
          <path
            d="M4.656,11.318L9.093,11.318"
            stroke="currentColor"
            strokeWidth="2"
          />
        </g>
      </g>
    </ShotSvg>
  );
}

export function Shot4clIcon({ className }: { className?: string }) {
  return (
    <ShotSvg className={className}>
      <g transform="matrix(1,0,0,1,-0.366377,-4.10954)">
        <g transform="matrix(1.52573,0,0,2.11817,-0.454555,-8.42669)">
          <path
            d="M1.193,7.554L2.807,17.721L9.193,17.721L10.807,7.554"
            stroke="currentColor"
            strokeWidth="1.08"
            strokeMiterlimit="1.5"
          />
        </g>
        <g transform="matrix(1.58265,0,0,1.58265,-0.796124,-5.44109)">
          <ellipse
            cx="6"
            cy="8.223"
            rx="4.634"
            ry="1.557"
            stroke="currentColor"
            strokeWidth="1.26"
            strokeMiterlimit="1.5"
          />
        </g>
      </g>
    </ShotSvg>
  );
}

export function Shot4clStrongIcon({ className }: { className?: string }) {
  return (
    <ShotSvg className={className}>
      <g transform="matrix(1.52573,0,0,2.11817,-0.820931,-12.5362)">
        <path
          d="M1.193,7.554L2.807,17.721L9.193,17.721L10.807,7.554"
          stroke="currentColor"
          strokeWidth="1.08"
          strokeMiterlimit="1.5"
        />
      </g>
      <g transform="matrix(1.58265,0,0,1.58265,-1.1625,-9.55063)">
        <ellipse
          cx="6"
          cy="8.223"
          rx="4.634"
          ry="1.557"
          stroke="currentColor"
          strokeWidth="1.26"
          strokeMiterlimit="1.5"
        />
      </g>
      <g transform="matrix(1,0,0,1,0.158685,0)">
        <path
          d="M4.989,14.038L11.361,14.038"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
      <g transform="matrix(6.12323e-17,1,-1,6.12323e-17,22.371,5.86282)">
        <path
          d="M4.989,14.038L11.361,14.038"
          stroke="currentColor"
          strokeWidth="2"
        />
      </g>
    </ShotSvg>
  );
}

// Roisin-cocktails (2026-09-21): mellem har pynt, stærk har ekstra
// "sprut"-streger. Delt 24×26-viewBox (stærk, 23×24, er centreret i
// rammen), så begge renderes med identisk klasse.

function CocktailSvg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 26"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CocktailMediumIcon({ className }: { className?: string }) {
  return (
    <CocktailSvg className={className}>
      <g transform="matrix(1,0,0,1,-4.06546,-2.76109)">
        <g transform="matrix(1.05409,0,0,1.05409,0.90336,4.32119)">
          <path
            d="M12,12L4.207,4.207C4.074,4.074 4,3.894 4,3.707C4,3.319 4.319,3 4.707,3L19.293,3C19.681,3 20,3.319 20,3.707C20,3.894 19.926,4.074 19.793,4.207L12,12Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M12,12L12,22" stroke="currentColor" strokeWidth="2" />
          <path d="M7,22L17,22" stroke="currentColor" strokeWidth="2" />
        </g>
        <g transform="matrix(1.22562,0,0,1.22562,-0.420799,-0.792186)">
          <path
            d="M14.183,6.752C14.183,6.752 17.212,4.662 18.405,3.839C18.715,3.625 19.082,3.511 19.458,3.511C20.452,3.511 22.38,3.511 22.38,3.511"
            stroke="currentColor"
            strokeWidth="1.22"
            strokeMiterlimit="1.5"
          />
        </g>
      </g>
    </CocktailSvg>
  );
}

export function CocktailStrongIcon({ className }: { className?: string }) {
  return (
    <CocktailSvg className={className}>
      <g transform="translate(0.5,1)">
        <g transform="matrix(1,0,0,1,-1.07377,-0.535741)">
          <g transform="matrix(0.860041,0,0,0.860041,1.67951,4.17206)">
            <path
              d="M12,12L4.207,4.207C4.074,4.074 4,3.894 4,3.707C4,3.319 4.319,3 4.707,3L19.293,3C19.681,3 20,3.319 20,3.707C20,3.894 19.926,4.074 19.793,4.207L12,12Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M12,12L12,22" stroke="currentColor" strokeWidth="2" />
            <path d="M7,22L17,22" stroke="currentColor" strokeWidth="2" />
          </g>
          <g transform="matrix(1,0,0,1,0.599117,0)">
            <path
              d="M14.183,6.752C14.183,6.752 17.04,4.781 18.298,3.913C18.677,3.651 19.127,3.511 19.588,3.511C20.61,3.511 22.38,3.511 22.38,3.511"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="1.5"
            />
          </g>
          <g transform="matrix(1,0,0,1,-1.37306,-0.112675)">
            <path
              d="M9.225,6.752L5.676,3.934L9.788,1.398"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="1.5"
            />
            <path
              d="M5.676,3.934L3.197,8.243"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="1.5"
            />
          </g>
        </g>
      </g>
    </CocktailSvg>
  );
}
