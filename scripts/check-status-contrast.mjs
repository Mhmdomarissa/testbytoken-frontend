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
  if (!match) throw new Error(`Token --${name} not found`);
  return match[1];
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

// Viénot/Brettel-style linear-RGB dichromacy matrices - same family Chrome
// DevTools' vision-deficiency emulation uses.
const CVD_MATRICES = {
  protanopia: [
    [0.56667, 0.43333, 0],
    [0.55833, 0.44167, 0],
    [0, 0.24167, 0.75833],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.43333, 0.56667],
    [0, 0.475, 0.525],
  ],
};
function simulateCVD(hex, type) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const m = CVD_MATRICES[type];
  return rgbToHex(m.map(([a, b2, c]) => linearToSrgb(a * r + b2 * g + c * b)));
}

const BLUE_DEEP = tokenHex("color-blue-deep");
const BLUE_MID = tokenHex("color-blue-mid");
const STATUSES = ["pass", "fail", "running", "queued", "skipped"];
const fg = Object.fromEntries(
  STATUSES.map((s) => [s, tokenHex(`status-${s}-fg`)]),
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
