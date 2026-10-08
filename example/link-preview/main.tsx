import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Iris, useIris } from "../../src/index";
import "../example.css";
import "./link-preview.css";

// Dark mode reuses example.css's body[data-dark-mode="true"] cells, the same
// switch the Design sheet flips on the other pages. Here it follows the OS
// scheme; ?dark=1 or ?dark=0 overrides it (for testing, and for the specs).
const darkParam = new URLSearchParams(location.search).get("dark");
const prefersDark = matchMedia("(prefers-color-scheme: dark)");
const applyDark = () => {
  const dark = darkParam === null ? prefersDark.matches : darkParam === "1";
  document.body.dataset.darkMode = dark ? "true" : "false";
};
applyDark();
if (darkParam === null) prefersDark.addEventListener("change", applyDark);

// A hover card on a text link: <Root preview>, the <a> is the trigger.
// Hover or focus a link, or press and hold on touch.

function LinkPreview({ href, children }: { href: string; children: string }) {
  return (
    <Iris.Root preview className="lp">
      <Iris.Shadow />
      <Iris.Trigger asChild>
        <a className="lp-link" href={href}>
          {children}
        </a>
      </Iris.Trigger>
      <Iris.Sheet
        aria-label={`Preview of ${children}`}
        aspectRatio={360 / 520}
      >
        <Iris.Content>
          <PreviewFrame href={href} />
        </Iris.Content>
      </Iris.Sheet>
    </Iris.Root>
  );
}

// One live iframe at a time: mounted on open, gone the instant a close starts.
function PreviewFrame({ href }: { href: string }) {
  const { open } = useIris();
  const [loaded, setLoaded] = useState(false);
  if (!open) return null;
  const src = new URL(href, location.origin);
  src.searchParams.set("preview", "1");
  return (
    <>
      <div
        className="lp-skeleton"
        data-loaded={loaded || undefined}
        aria-hidden="true"
      />
      <iframe
        className="lp-iframe"
        src={src.href}
        title={`Preview of ${href}`}
        tabIndex={-1}
        data-loaded={loaded || undefined}
        onLoad={() => setLoaded(true)}
      />
      <a className="lp-open" href={href} tabIndex={-1}>
        Open
      </a>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <main className="lp-page">
    <h1>Link preview</h1>
    <p>
      I design and build. Start with{" "}
      <LinkPreview href="https://www.seansmithdesign.com/projects/brukas">
        my write-up of the Brukas project
      </LinkPreview>
      , then{" "}
      <LinkPreview href="https://www.seansmithdesign.com/projects/ghostties">
        Ghostties
      </LinkPreview>{" "}
      or{" "}
      <LinkPreview href="https://www.seansmithdesign.com/projects/dab">
        Dab
      </LinkPreview>
      . The{" "}
      <LinkPreview href="https://www.seansmithdesign.com/lab/orchestrator">
        orchestrator
      </LinkPreview>{" "}
      is how I run it all now, and{" "}
      <LinkPreview href="https://www.seansmithdesign.com/writing/how-i-work-now">
        how I work now
      </LinkPreview>{" "}
      says why.
    </p>
    <p className="lp-corner">
      Also see{" "}
      <LinkPreview href="https://www.seansmithdesign.com">
        my portfolio
      </LinkPreview>
    </p>
  </main>,
);
