#!/usr/bin/env node
/**
 * Reproduces every status-colour and CVD number in docs/DESIGN_SYSTEM_APP.md
 * ("Status colours - UI v2"), in BOTH themes, from the committed
 * styles/tokens.css - not hardcoded values. Run it after any status token
 * edit, before updating the doc. The gates themselves (4.5:1 labels, 3:1
 * icons, pass vs fail >= 1.5:1) live in src/lib/color/contrast.test.ts and
 * run in CI; this is the fuller report for a human.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const tokensPath = path.join(import.meta.dirname, "..", "styles", "tokens.css");
const css = readFileSync(tokensPath, "utf8");

/** `--name: light-dark(#light, #dark)` -> the hex for one theme. */
function token(name, theme) {
  const m = css.match(
    new RegExp(
      `--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{6})\\s*,\\s*(#[0-9a-fA-F]{6})\\s*\\)`,
    ),
  );
  if (!m) throw new Error(`--${name} is not a light-dark(#hex, #hex) pair`);
  return theme === "light" ? m[1] : m[2];
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  const c = (v) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  // The Machado 2009 matrices can produce slightly negative linear
  // components for some inputs (an out-of-real-gamut intermediate before
  // final clamping in rgbToHex) - clamp here too, or Math.pow(negative,
  // non-integer) below produces NaN.
  c = Math.max(c, 0);
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}
function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)];
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Machado, Oliveira & Fluck (2009) 100%-severity dichromacy matrices,
// applied to linear sRGB - the model Chrome DevTools' vision-deficiency
// emulation actually uses.
//
// CORRECTED per the pre-Phase-B review (item 2): this file previously
// used an older Viénot/Brettel-style approximation (a different, also
// real, published model - not a bug in arithmetic, a wrong choice of
// model) and mislabeled it as "the same family Chrome DevTools uses",
// which it is not. That mislabeling was the actual bug: it made a
// reported number (protanopia pass/fail = 1.03:1) look load-bearing for a
// specific-tool claim it didn't back up. Re-run against the Machado 2009
// matrices below, the same pair now measures ~2.5:1 - both models are
// legitimate simulations of the same underlying dichromacy, but they are
// not interchangeable, and only one of them matches what a reviewer
// checking against Chrome DevTools would see. See DESIGN_SYSTEM_APP.md
// for the full reconciliation.
const CVD_MATRICES = {
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
function simulateCVD(hex, type) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const m = CVD_MATRICES[type];
  return rgbToHex(m.map(([a, b2, c]) => linearToSrgb(a * r + b2 * g + c * b)));
}

const STATUSES = [
  "pass",
  "fail",
  "running",
  "queued",
  "skipped",
  "cancelled",
  "warning",
  "timed-out",
];
// The pairs a reader actually has to tell apart at a glance.
// The first three are the asserted floor (>=1.5:1 in every column, both
// themes): pass vs every non-passing terminal verdict.
const MEANINGFUL_PAIRS = [
  ["pass", "fail"],
  ["pass", "timed-out"],
  ["pass", "cancelled"],
  ["running", "fail"],
  ["warning", "fail"],
];

for (const theme of ["light", "dark"]) {
  const fg = (s) => token(`status-${s}-fg`, theme);
  const tint = (s) => token(`status-${s}-tint`, theme);
  const card = token("surface-card", theme);
  const raised = token("surface-raised", theme);
  const ink = token("ink", theme);
  const on = token("status-on", theme);

  console.log(`\n=============== ${theme.toUpperCase()} ===============`);
  console.log(
    "--- per status: icon (3:1), label on tint (4.5:1), filled label (4.5:1) ---",
  );
  for (const s of STATUSES) {
    console.log(
      `${s.padEnd(10)} ${fg(s)} / ${tint(s)}  icon:tint=${contrastRatio(fg(s), tint(s)).toFixed(2)} icon:card=${contrastRatio(fg(s), card).toFixed(2)} icon:raised=${contrastRatio(fg(s), raised).toFixed(2)}  label:tint=${contrastRatio(ink, tint(s)).toFixed(2)}  filled=${contrastRatio(on, fg(s)).toFixed(2)}`,
    );
  }

  console.log(
    "\n--- pairwise lightness between status colours (normal vision) ---",
  );
  for (let i = 0; i < STATUSES.length; i++) {
    for (let j = i + 1; j < STATUSES.length; j++) {
      const [a, b] = [STATUSES[i], STATUSES[j]];
      if (fg(a) === fg(b)) continue; // shared colour by design (icon + label differ)
      console.log(`${a} vs ${b}: ${contrastRatio(fg(a), fg(b)).toFixed(2)}`);
    }
  }

  console.log(
    "\n--- meaningful pairs under CVD (Machado 2009, 100% severity) ---",
  );
  for (const [a, b] of MEANINGFUL_PAIRS) {
    const row = [
      `${a} vs ${b}`.padEnd(22),
      `normal=${contrastRatio(fg(a), fg(b)).toFixed(2)}`,
    ];
    for (const type of Object.keys(CVD_MATRICES)) {
      row.push(
        `${type}=${contrastRatio(simulateCVD(fg(a), type), simulateCVD(fg(b), type)).toFixed(2)}`,
      );
    }
    console.log(row.join("  "));
  }
}
