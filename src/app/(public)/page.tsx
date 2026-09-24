import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { DemoForm, DemoProvider, DemoReport } from "./_landing/demo";
import { ghostClass } from "./_landing/styles";

/**
 * The public landing page (docs/PHASE_LANDING_POLISH.md, Part L).
 *
 * Copy, section order and interaction vocabulary come from
 * docs/reference/index.html; colour, type and motion are this app's. A
 * signed-in visitor never renders this: proxy.ts redirects them to
 * /overview before anything is served.
 *
 * Styling is scoped to this page's own elements - none of the source's
 * global resets come with it.
 */

export const metadata: Metadata = {
  title: "Test by Token — Testing as a Service",
};

const BRAND = "Test by Token";

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

const container = "mx-auto w-full max-w-[1280px] px-4 sm:px-8 lg:px-[60px]";
const label =
  "text-[0.625rem] font-bold tracking-[0.2em] text-muted-foreground uppercase";
const goldButton =
  "inline-flex min-h-12 items-center justify-center bg-primary px-12 text-xs font-extrabold tracking-[0.16em] text-primary-foreground uppercase transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--color-gold),var(--color-warm-white)_18%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const underlineLink =
  "inline-flex items-center gap-3 border-b-2 border-primary pb-1 text-[0.6875rem] font-extrabold tracking-[0.2em] text-foreground uppercase transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
// Every photograph is greyscale under a blue-deep wash, so none of them
// brings a hue of its own into the palette.
const photo = "object-cover grayscale";

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <Nav />
      <DemoProvider>
        <Hero />
        <DemoReport />
      </DemoProvider>
      <Stats />
      <About />
      <Services />
      <How />
      <Cta />
      <Footer />
    </div>
  );
}

function Nav() {
  const links = [
    ["#how", "How it works"],
    ["#services", "What we test"],
    ["#about", `Why ${BRAND}`],
    ["#contact", "Contact"],
  ] as const;
  return (
    <nav
      aria-label="Site"
      className="sticky top-0 z-20 border-b border-border bg-background"
    >
      <div
        className={cn(
          container,
          "flex h-[76px] items-center justify-between gap-4",
        )}
      >
        <Link
          href="/"
          className="flex flex-col leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="font-heading text-xl font-light">{BRAND}</span>
          <span className="mt-0.5 text-[0.5625rem] font-medium tracking-[0.26em] text-muted-foreground uppercase">
            Testing as a Service
          </span>
        </Link>
        <ul className="hidden items-center gap-10 lg:flex">
          {links.map(([href, text]) => (
            <li key={href}>
              <a
                href={href}
                className="border-b-2 border-transparent pb-1 text-[0.6875rem] font-semibold tracking-[0.15em] uppercase transition-colors duration-150 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {text}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/sign-in"
            className="text-[0.6875rem] font-semibold tracking-[0.15em] uppercase transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Sign in
          </Link>
          <a href="#demo" className={cn(ghostClass, "hidden sm:inline-flex")}>
            Run a Test
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative scroll-mt-[76px] overflow-hidden lg:min-h-[700px]"
    >
      <Image
        src={unsplash("1519501025264-65ba15a82390")}
        alt="A city street between tall buildings at dusk, cars waiting at a crossing"
        fill
        priority
        sizes="100vw"
        className={photo}
      />
      {/* Phones get a flat wash (the text sits over the whole photo there);
          wide screens get the source's left-to-right fade. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/90 lg:bg-transparent lg:bg-linear-100 lg:from-background/90 lg:from-38% lg:via-background/60 lg:via-70% lg:to-background/30"
      />
      <div
        className={cn(
          container,
          "relative grid items-center gap-10 py-12 sm:py-16 lg:min-h-[700px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-16",
        )}
      >
        <div>
          <Eyebrow onImage className="mb-6 lg:mb-8">
            Real Browsers · Real Proof
          </Eyebrow>
          <h1
            id="hero-heading"
            className="mb-6 font-heading text-[2.5rem] leading-[1.08] font-light sm:text-5xl lg:mb-8 lg:text-[3.75rem]"
          >
            See your website <br className="hidden sm:inline" />
            <em className="text-primary not-italic">tested and proven</em>{" "}
            <br className="hidden sm:inline" />
            in seconds.
          </h1>
          <p className="max-w-[30rem] text-[0.9375rem] leading-[1.85] text-muted-foreground">
            Paste a URL and tell us what to check in plain English. A real
            Chromium browser runs every step — then hands you a signed,
            tamper-evident record you can keep.
          </p>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    ["100%", "Real Browser Runs"],
    ["SHA-256", "Signed Trace, Every Run"],
    ["<60s", "From URL to Proof"],
    ["0", "Credentials Stored"],
  ] as const;
  return (
    <section
      aria-label="At a glance"
      className="border-t-[3px] border-b border-t-primary border-b-border bg-card px-4 py-11 sm:px-8"
    >
      <dl className="mx-auto grid max-w-[1280px] grid-cols-2 gap-y-10 lg:flex lg:justify-center lg:divide-x lg:divide-border">
        {stats.map(([num, text]) => (
          <div
            key={text}
            className="flex flex-col-reverse items-center px-2 text-center lg:px-12"
          >
            <dt className={cn(label, "mt-2.5")}>{text}</dt>
            <dd className="text-[1.875rem] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums sm:text-[2.5rem] lg:text-[3.375rem]">
              {num}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="grid scroll-mt-[76px] md:min-h-[580px] md:grid-cols-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto">
        <Image
          src={unsplash("1600880292203-757bb62b4baf")}
          alt="Two colleagues high-five across a desk with a laptop and papers"
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className={photo}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-background/50" />
        <div className="absolute right-0 bottom-6 border border-l-4 border-border border-l-primary bg-background px-6 py-5 sm:bottom-10 sm:px-9 sm:py-7">
          <p className="text-[2.5rem] leading-none font-extrabold tabular-nums">
            1:1
          </p>
          <p className={cn(label, "mt-2")}>Every Step, Evidenced</p>
        </div>
      </div>
      <div className="flex flex-col justify-center bg-card px-4 py-16 sm:px-8 md:px-[72px] md:py-20">
        <Eyebrow className="mb-7">Why {BRAND}</Eyebrow>
        <h2
          id="about-heading"
          className="mb-8 font-heading text-[2rem] leading-[1.18] font-light sm:text-[2.75rem]"
        >
          Not a chatbot guessing. <br className="hidden sm:inline" />
          <Underlined>A browser that shows its work.</Underlined>
        </h2>
        <p className="mb-5 text-[0.9375rem] leading-[1.9] text-muted-foreground">
          Most AI testing tools read your page and tell you what they think.{" "}
          {BRAND} launches a real Chromium browser, performs each check against
          your live site, and records what actually happened — step by step,
          millisecond by millisecond.
        </p>
        <p className="mb-5 text-[0.9375rem] leading-[1.9] text-muted-foreground">
          Every run produces a screenshot and a SHA-256-hashed trace. If anyone
          alters a single step of the record, the hash breaks. That&apos;s
          evidence you can hand to a client, an auditor, or your own team.
        </p>
        <p className="mt-6">
          <a href="#demo" className={underlineLink}>
            <span>Run your first test</span>
            <span aria-hidden="true" className="text-base">
              →
            </span>
          </a>
        </p>
      </div>
    </section>
  );
}

function Services() {
  const services = [
    {
      num: "01",
      img: "1522071820081-009f0129c71c",
      alt: "People working on laptops around a shared table, code on one screen",
      title: "Availability & Performance",
      body: "A real page load with HTTP status verification, title capture, and a hard load-time budget — measured from an actual browser, not a ping.",
    },
    {
      num: "02",
      // Not the source's photo: that one was a recognisable real product's
      // analytics dashboard, captioned "Secure infrastructure".
      img: "1680992046626-418f7e910589",
      alt: "A server rack with rows of patch cables, in a dark room",
      title: "Security Essentials",
      body: "HTTPS enforcement and login-screen presence, confirmed by inspecting the rendered page — the way a visitor would actually see it.",
    },
    {
      num: "03",
      img: "1573496359142-b8d87734a5a2",
      alt: "A person in a blazer holding a closed laptop by an office window",
      title: "Auditable Proof",
      body: "Every run ends with a full-page screenshot and a SHA-256-hashed trace of each step — a tamper-evident record that belongs to you.",
    },
  ];
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="scroll-mt-[76px] bg-background py-16 md:py-[90px]"
    >
      <div className={container}>
        <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow className="mb-5">What We Test</Eyebrow>
            <h2
              id="services-heading"
              className="font-heading text-[2rem] leading-[1.15] font-light sm:text-[2.875rem]"
            >
              Checks on the free tier
            </h2>
          </div>
          <p>
            <a href="#demo" className={underlineLink}>
              Run a free test →
            </a>
          </p>
        </div>
        <ul className="grid gap-px bg-border md:grid-cols-3">
          {services.map((s) => (
            <li
              key={s.num}
              className="overflow-hidden bg-background transition-colors duration-150 hover:bg-card"
            >
              <div className="relative h-[200px] overflow-hidden">
                <Image
                  src={unsplash(s.img)}
                  alt={s.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className={photo}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-background/40"
                />
                {/* On a solid chip: gold over a photograph can't promise contrast. */}
                <span className="absolute top-5 left-5 bg-background px-2 py-1 text-[0.9375rem] font-extrabold tracking-[0.04em] text-primary tabular-nums">
                  {s.num}
                </span>
              </div>
              <div className="px-6 pt-8 pb-10 sm:px-8">
                <Divider className="mb-5" />
                <h3 className="mb-4 font-heading text-2xl leading-tight font-light">
                  {s.title}
                </h3>
                <p className="text-sm leading-[1.8] text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function How() {
  const tiles = [
    [
      "01",
      "Paste your URL",
      "Any public site. Private and internal targets are blocked on the free tier by design.",
    ],
    [
      "02",
      "Describe the test",
      "Plain English, or one tap on a quick pick. We map it to concrete, supported checks.",
    ],
    [
      "03",
      "A real browser runs it",
      "Chromium performs each step against your live site — read-only, hard-timeboxed.",
    ],
    [
      "04",
      "Keep the proof",
      "Verdict, timings, screenshot, and a SHA-256 trace hash. Yours to keep and verify.",
    ],
  ] as const;
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="scroll-mt-[76px] border-t border-border bg-card py-16 md:py-[90px]"
    >
      <div className={container}>
        <Eyebrow centered className="mb-5">
          How It Works
        </Eyebrow>
        <h2
          id="how-heading"
          className="mb-12 text-center font-heading text-[2rem] leading-[1.15] font-light sm:text-[2.875rem] md:mb-16"
        >
          From URL to proof in four steps
        </h2>
        <ol className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([num, name, desc]) => (
            <li
              key={num}
              className="border-b-2 border-transparent bg-background px-7 py-8 transition-colors duration-150 hover:border-primary hover:bg-card"
            >
              <Divider className="mb-4 w-7" />
              <p className="mb-3 text-sm font-extrabold tabular-nums">{num}</p>
              <h3 className="mb-2.5 font-heading text-xl leading-tight font-light">
                {name}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section
      id="contact"
      aria-labelledby="cta-heading"
      className="relative scroll-mt-[76px] overflow-hidden"
    >
      <Image
        src={unsplash("1486406146926-c627a92ad1ab")}
        alt="Glass office towers seen from street level, looking up"
        fill
        sizes="100vw"
        className={photo}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/90 md:bg-transparent md:bg-linear-90 md:from-background md:from-42% md:via-background/70 md:via-75% md:to-background/30"
      />
      <div
        className={cn(
          container,
          "relative flex min-h-[360px] flex-col items-start justify-center gap-8 py-16 md:flex-row md:items-center md:justify-between",
        )}
      >
        <div>
          <h2
            id="cta-heading"
            className="mb-4 font-heading text-[2rem] leading-[1.15] font-light sm:text-5xl"
          >
            Stop taking{" "}
            <em className="text-primary not-italic">&quot;it works&quot;</em> on
            faith.
          </h2>
          <p className="text-[0.9375rem] leading-[1.7] text-muted-foreground">
            Your first test is free — no sign-up, no credentials, proof in under
            a minute.
          </p>
        </div>
        <a href="#demo" className={cn(goldButton, "shrink-0")}>
          Run a Free Test
        </a>
      </div>
    </section>
  );
}

function Footer() {
  // Only what exists is a link. The source's "#" placeholders (pricing,
  // security, API docs, status, legal) have no page behind them yet, so
  // they're listed as text rather than as links that go nowhere.
  const cols: { head: string; items: [string, string | null][] }[] = [
    {
      head: "Product",
      items: [
        ["What we test", "#services"],
        ["How it works", "#how"],
        ["Run a free test", "#demo"],
        ["Sample report", "/p/share_demo"],
      ],
    },
    {
      head: "Company",
      items: [
        [`Why ${BRAND}`, "#about"],
        ["Security", null],
        ["Pricing", null],
        ["Contact", "#contact"],
      ],
    },
    {
      head: "Developers",
      items: [
        ["API docs", null],
        ["Trace verification", null],
        ["Status", null],
      ],
    },
  ];
  return (
    <footer className="border-t border-border bg-[var(--color-footer-deep)] px-4 pt-16 pb-11 sm:px-8 md:pt-[72px] lg:px-[60px]">
      <div className="mx-auto mb-14 grid max-w-[1280px] gap-12 sm:grid-cols-2 lg:grid-cols-[2.2fr_1fr_1fr_1fr] lg:gap-14">
        <div>
          <p className="inline-block border-b-2 border-primary pb-0.5 font-heading text-xl font-light">
            {BRAND}
          </p>
          <p className="mt-1.5 mb-6 text-[0.5625rem] font-medium tracking-[0.26em] text-muted-foreground uppercase">
            Testing as a Service
          </p>
          <p className="max-w-[16.25rem] text-[0.8125rem] leading-[1.85] text-muted-foreground">
            Deterministic, auditable website testing. A real browser runs your
            checks and hands you evidence — not opinions.
          </p>
          {/* No accounts exist behind these yet; shown as the source lays
              them out, but not presented as links. */}
          <div aria-hidden="true" className="mt-8 flex gap-4">
            {["in", "tw", "gh"].map((s) => (
              <span
                key={s}
                className="flex size-9 items-center justify-center border border-border text-[0.6875rem] font-bold tracking-[0.05em] text-muted-foreground uppercase"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        {cols.map((col) => (
          <div key={col.head}>
            <h2 className="mb-6 inline-block border-b-2 border-primary pb-1 text-[0.625rem] font-extrabold tracking-[0.22em] uppercase">
              {col.head}
            </h2>
            <ul className="flex flex-col gap-3.5">
              {col.items.map(([text, href]) => (
                <li key={text} className="text-[0.8125rem]">
                  {href === null ? (
                    <span className="text-[var(--text-tertiary)]">{text}</span>
                  ) : (
                    <FooterLink href={href}>{text}</FooterLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 border-t border-border pt-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 {BRAND}. All rights reserved.</p>
        <p className="flex gap-7 text-[var(--text-tertiary)]">
          <span>Privacy Policy</span>
          <span>Terms</span>
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    "text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function Underlined({ children }: { children: ReactNode }) {
  return (
    <em className="border-b-4 border-primary not-italic [box-decoration-break:clone]">
      {children}
    </em>
  );
}

function Divider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block h-[3px] w-8 bg-primary", className)}
    />
  );
}
