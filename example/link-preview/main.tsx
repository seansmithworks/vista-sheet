import { useState } from "react";
import { createRoot } from "react-dom/client";
import { VistaSheet, useVistaSheet } from "../../src/index";
import "./link-preview.css";

// A hover card on a text link: <Root preview>, the <a> is the trigger.
// Hover or focus a link, or press and hold on touch.

function LinkPreview({ href, children }: { href: string; children: string }) {
  return (
    <VistaSheet.Root preview className="lp">
      <VistaSheet.Shadow />
      <VistaSheet.Trigger asChild>
        <a className="lp-link" href={href}>{children}</a>
      </VistaSheet.Trigger>
      <VistaSheet.Sheet aria-label={`Preview of ${children}`} aspectRatio={360 / 520}>
        <VistaSheet.Content>
          <PreviewFrame href={href} />
        </VistaSheet.Content>
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}

// One live iframe at a time: mounted on open, gone the instant a close starts.
function PreviewFrame({ href }: { href: string }) {
  const { open } = useVistaSheet();
  const [loaded, setLoaded] = useState(false);
  if (!open) return null;
  const src = new URL(href, location.origin);
  src.searchParams.set("preview", "1");
  return (
    <>
      <div className="lp-skeleton" data-loaded={loaded || undefined} aria-hidden="true" />
      <iframe className="lp-iframe" src={src.href} title={`Preview of ${href}`}
        tabIndex={-1} data-loaded={loaded || undefined} onLoad={() => setLoaded(true)} />
      <a className="lp-open" href={href} tabIndex={-1}>Open</a>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <main className="lp-page">
    <h1>Link preview</h1>
    <p>
      The sheet started as a rough sketch of a <LinkPreview href="/flagship.html">flagship contact card</LinkPreview>,
      then a quiet <LinkPreview href="/list.html">list menu</LinkPreview>, and a{" "}
      <LinkPreview href="/play.html">playground</LinkPreview> to try shapes.
    </p>
    <p className="lp-corner">
      Also see <LinkPreview href="https://seansmithdesign.com">my portfolio</LinkPreview>
    </p>
  </main>,
);
