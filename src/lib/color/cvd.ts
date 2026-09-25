/**
 * Colour-vision-deficiency simulation: Machado, Oliveira & Fluck (2009),
 * 100% severity, applied to linear sRGB - the model Chrome DevTools'
 * vision-deficiency emulation uses. Shared by src/lib/color/contrast.test.ts
 * (the floor, in CI) and mirrored in scripts/check-status-contrast.mjs (the
 * human-readable report), so both measure the same way.
 */
export const CVD_TYPES = ["protanopia", "deuteranopia", "tritanopia"] as const;
export type CvdType = (typeof CVD_TYPES)[number];

const MATRICES: Record<CvdType, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  // The matrices can yield slightly negative components; clamp, or the
  // power below returns NaN.
  c = Math.max(c, 0);
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}

/** How `hex` appears to a viewer with the given dichromacy, as hex. */
export function simulateCvd(hex: string, type: CvdType): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    srgbToLinear,
  ) as [number, number, number];
  return (
    "#" +
    MATRICES[type]
      .map(([a, b2, c]) =>
        Math.round(
          Math.min(255, Math.max(0, linearToSrgb(a! * r + b2! * g + c! * b))),
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
