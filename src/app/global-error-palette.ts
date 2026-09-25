/**
 * global-error.tsx renders its own <html> when the ROOT layout has crashed,
 * so the stylesheet and its tokens can't be assumed to have loaded. It is
 * the second sanctioned raw-hex exception (with the OG image). These are
 * each token's DARK value; global-error-palette.test.ts fails on drift.
 */
export const GLOBAL_ERROR_PALETTE = {
  page: "#0a1120", // --surface-page (dark)
  ink: "#edf1f7", // --ink (dark)
};

export const GLOBAL_ERROR_TOKEN_OF = {
  page: "surface-page",
  ink: "ink",
};
