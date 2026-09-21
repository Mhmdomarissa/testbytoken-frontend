#!/usr/bin/env node
/**
 * Reproduces every contrast/CVD number in docs/DESIGN_SYSTEM_APP.md's
 * "Isoluminance" section, from the actual committed styles/tokens.css -
 * not hardcoded values. Run this after any status-color token edit to
 * re-check the numbers before updating the doc. (The pass/fail-vs-1.8:1
 * regression guard itself lives in src/lib/color/contrast.test.ts and
 * runs in CI; this script is the fuller report for a human, not a gate.)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const tokensPath = path.join(import.meta.dirname, "..", "styles", "tokens.css");
const css = readFileSync(tokensPath, "utf8");

function tokenHex(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (match) return match[1];
  // `--status-warning-fg: var(--color-gold);` - warning deliberately
  // stays the literal accent color rather than its own derived hex.
  const varMatch = css.match(
    new RegExp(`--${name}:\\s*var\\(\\s*--([\\w-]+)\\s*\\)`),
  );
  if (varMatch) return tokenHex(varMatch[1]);
  throw new Error(`Token --${name} not found`);
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

const BLUE_DEEP = tokenHex("color-blue-deep");
const BLUE_MID = tokenHex("color-blue-mid");
const STATUSES = [
  "fail",
  "timed_out",
  "queued",
  "skipped",
  "warning",
  "running",
  "pass",
];
const fg = Object.fromEntries(
  STATUSES.map((s) => [s, tokenHex(`status-${s.replace(/_/g, "-")}-fg`)]),
);

console.log("--- foreground vs grounds ---");
for (const s of STATUSES) {
  console.log(
    `${s.padEnd(10)} ${fg[s]}   vs blue-deep=${contrastRatio(fg[s], BLUE_DEEP).toFixed(2)}  vs blue-mid=${contrastRatio(fg[s], BLUE_MID).toFixed(2)}`,
  );
}

console.log("\n--- pairwise contrast (normal vision) ---");
for (let i = 0; i < STATUSES.length; i++) {
  for (let j = i + 1; j < STATUSES.length; j++) {
    const [a, b] = [STATUSES[i], STATUSES[j]];
    console.log(`${a} vs ${b}: ${contrastRatio(fg[a], fg[b]).toFixed(2)}`);
  }
}

console.log("\n--- pass vs fail under CVD simulation ---");
for (const type of Object.keys(CVD_MATRICES)) {
  const passCvd = simulateCVD(fg.pass, type);
  const failCvd = simulateCVD(fg.fail, type);
  console.log(
    `${type.padEnd(14)} pass->${passCvd}  fail->${failCvd}  contrast=${contrastRatio(passCvd, failCvd).toFixed(2)}`,
  );
}
