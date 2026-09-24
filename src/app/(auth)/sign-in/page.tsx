import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { SignInForm } from "./SignInForm";

const PHOTO = "https://images.unsplash.com/photo-1519501025264-65ba15a82390";

/** Next's own image-optimizer URL (its documented default loader format), at one of its default widths. */
const optimised = (width: number) =>
  `/_next/image?url=${encodeURIComponent(PHOTO)}&w=${width}&q=75`;

/**
 * A server component on purpose, and deliberately without <Image> or
 * <Link>: the landing's photograph and voice arrive with no client JS.
 * Importing anything from next/image - even the server-side
 * getImageProps - pulls its client module into this route's bundle
 * (~6 KB, measured), and <Link> another ~4 KB, for a decorative photo and
 * a link out of this route group. So: a plain <img> on the same optimizer
 * URLs <Image> would request, and a plain link. Only the form is a client
 * component.
 */
export default function SignInPage() {
  return (
    <main className="grid min-h-svh bg-background md:grid-cols-[1.1fr_1fr]">
      {/* The landing's hero photograph and voice, so the step from the site
          into the product doesn't feel like a different product. Wide
          screens only; phones get the form alone. */}
      <section
        aria-labelledby="sign-in-promise"
        className="relative hidden overflow-hidden border-r border-border md:block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- see the note on SignInPage: <Image> costs ~6 KB of client JS here */}
        <img
          src={optimised(1200)}
          srcSet={[828, 1200, 1920]
            .map((w) => `${optimised(w)} ${w}w`)
            .join(", ")}
          sizes="55vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover grayscale"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-background from-10% via-background/80 to-background/40"
        />
        <div className="relative flex h-full flex-col justify-end p-12 lg:p-16">
          <Eyebrow onImage>Real browsers · Real proof</Eyebrow>
          <p
            id="sign-in-promise"
            className="mt-6 max-w-md font-heading text-4xl leading-[1.1] font-light lg:text-5xl"
          >
            Evidence, <em className="text-primary not-italic">not opinions.</em>
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            You sign in here with a magic link. You sign in to your own
            application in a live browser you control - we never ask for its
            password.
          </p>
        </div>
      </section>

      <div className="flex flex-col px-6 py-8 sm:px-12">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the note on SignInPage: <Link> costs ~4 KB of client JS here */}
        <a
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          Back to site
        </a>
        <div className="my-auto w-full max-w-sm self-center py-12">
          <p className="text-[0.5625rem] font-medium tracking-[0.26em] text-muted-foreground uppercase">
            Testing as a Service
          </p>
          <h1 className="mt-2 font-heading text-4xl font-light">
            Test by Token
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with a magic link. No password, ever.
          </p>
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
