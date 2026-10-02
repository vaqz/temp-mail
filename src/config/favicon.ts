export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Vaqz Mobiz VM">
  <defs>
    <linearGradient id="vmBlue" x1="18" y1="20" x2="110" y2="112" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8fe9ff"/>
      <stop offset="0.35" stop-color="#18b7ff"/>
      <stop offset="0.7" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#0a2f9f"/>
    </linearGradient>
    <linearGradient id="vmWhite" x1="30" y1="18" x2="62" y2="92" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#e8f4ff"/>
      <stop offset="1" stop-color="#8fcaff"/>
    </linearGradient>
    <filter id="vmShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#061a55" flood-opacity=".55"/>
    </filter>
  </defs>

  <g filter="url(#vmShadow)" transform="skewX(-5)">
    <path
      d="M12 22h19l18 43 18-43h19L58 104H40z"
      fill="url(#vmWhite)"
      stroke="#061a55"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path
      d="M51 104 63 80 76 57l11 20 11-20h18v47h-18V88l-11 18H75l-10-18-7 16z"
      fill="url(#vmBlue)"
      stroke="#061a55"
      stroke-width="3"
      stroke-linejoin="round"
    />
    <path
      d="M18 25h11l18 43 5-12 4 7-8 17z"
      fill="#ffffff"
      opacity=".28"
    />
  </g>
</svg>`;

export const FAVICON_MIME = "image/svg+xml";
