// Minimal Cesium mock for unit tests
// Only mocks what is actually imported in tested modules

export class Color {
  r: number;
  g: number;
  b: number;
  alpha: number;

  constructor(r = 0, g = 0, b = 0, alpha = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.alpha = alpha;
  }

  withAlpha(alpha: number): Color {
    return new Color(this.r, this.g, this.b, alpha);
  }

  static fromCssColorString(): Color {
    return new Color(0, 0, 0, 1);
  }
}
