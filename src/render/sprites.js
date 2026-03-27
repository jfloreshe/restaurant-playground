function svgDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createImageFromSvg(svgMarkup) {
  const image = new Image();
  image.src = svgDataUri(svgMarkup);
  return image;
}

export function createDefaultSprites() {
  const sprites = new Map();

  sprites.set(
    "rect-table",
    createImageFromSvg(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">`,
        `<rect x="8" y="8" width="104" height="64" rx="10" fill="#de8e2a" stroke="#6f3a00" stroke-width="6"/>`,
        `<rect x="20" y="24" width="80" height="32" rx="6" fill="#f0ba71" opacity="0.35"/>`,
        `</svg>`,
      ].join("")
    )
  );

  sprites.set(
    "round-table",
    createImageFromSvg(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">`,
        `<circle cx="60" cy="60" r="48" fill="#d17a1a" stroke="#6f3a00" stroke-width="8"/>`,
        `<circle cx="60" cy="60" r="30" fill="#f0ba71" opacity="0.35"/>`,
        `</svg>`,
      ].join("")
    )
  );

  sprites.set(
    "chair",
    createImageFromSvg(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`,
        `<rect x="16" y="10" width="32" height="18" rx="6" fill="#4ab08e" stroke="#154e40" stroke-width="4"/>`,
        `<rect x="12" y="26" width="40" height="24" rx="7" fill="#67c7a8" stroke="#154e40" stroke-width="4"/>`,
        `<rect x="16" y="48" width="6" height="10" fill="#154e40"/>`,
        `<rect x="42" y="48" width="6" height="10" fill="#154e40"/>`,
        `</svg>`,
      ].join("")
    )
  );

  sprites.set(
    "sign",
    createImageFromSvg(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48">`,
        `<rect x="4" y="4" width="88" height="40" rx="8" fill="#2e80d8" stroke="#194678" stroke-width="4"/>`,
        `<rect x="44" y="44" width="8" height="4" fill="#194678"/>`,
        `</svg>`,
      ].join("")
    )
  );

  return sprites;
}
