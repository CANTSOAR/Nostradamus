import { Color } from "cesium";

/**
 * Convert a CSS hex color string (e.g. "#ff5500" or "rgb(255,85,0)")
 * to a Cesium.Color with the given alpha.
 */
export function hexToCesiumColor(hex: string, alpha = 0.7): Color {
  // Handle rgb(...) output from d3 interpolators
  if (hex.startsWith("rgb")) {
    const match = hex.match(/(\d+(?:\.\d+)?)/g);
    if (match && match.length >= 3) {
      return new Color(
        parseInt(match[0]) / 255,
        parseInt(match[1]) / 255,
        parseInt(match[2]) / 255,
        alpha
      );
    }
  }

  // Handle #rrggbb
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return new Color(r, g, b, alpha);
}
