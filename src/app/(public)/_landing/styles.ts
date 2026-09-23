// Class strings shared by the server-rendered page and the client demo. Kept
// out of demo.tsx: a server component importing a plain value from a
// "use client" module gets a client reference, not the string.
export const ghostClass =
  "inline-flex min-h-11 items-center border-[1.5px] border-foreground px-6 text-[0.6875rem] font-bold tracking-[0.15em] text-foreground uppercase transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
