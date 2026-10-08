import { createRoot } from "react-dom/client";
import { Iris } from "../../src/index";
import { CloseMask } from "../CloseMask";
import "./flagship.css";
import portraitUrl from "./portrait.jpg";

// The flagship's shared portrait, sized to 100% of whatever slot the package
// gives it (trigger-side inset circle, sheet-side margined circle) — same
// pattern as example/main.tsx's ColorCircle, just with a photo + the
// dither-bloom ring instead of a gradient.
function Portrait() {
  return (
    <div className="flagship-portrait">
      <img src={portraitUrl} alt="" />
    </div>
  );
}

const actions = [
  {
    label: "Email",
    handle: "sean@seansmithdesign.com",
    href: "mailto:sean@seansmithdesign.com",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        <path d="m4 6 8 7 8-7" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    handle: "seansmithworks",
    href: "https://www.linkedin.com/in/seansmithworks/",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7.5 9.5v7M7.5 6.75v.01M12 16.5v-4a2.25 2.25 0 0 1 4.5 0v4M12 12.5v4" />
      </svg>
    ),
  },
  {
    label: "X",
    handle: "@seansmithworks",
    href: "https://x.com/seansmithworks",
    // T4: a bare ✕ here read as a second close button — the same mark
    // src/Close.tsx draws for "dismiss this", one 480px surface away. The
    // actual X wordmark reads as "go to a social profile" instead. Solid
    // glyph, not an outline stroke like the other four icons.
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    handle: "seansmithworks",
    href: "https://github.com/seansmithworks",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2-.2 4.5-1 4.5-4.5a3.5 3.5 0 0 0-1-2.5 3.3 3.3 0 0 0-.1-2.5s-.9-.3-2.9 1a10 10 0 0 0-5.2 0c-2-1.3-2.9-1-2.9-1a3.3 3.3 0 0 0-.1 2.5 3.5 3.5 0 0 0-1 2.5c0 3.5 2.5 4.3 4.5 4.5-.4.4-.6.9-.5 1.7v3.8" />
      </svg>
    ),
  },
  {
    label: "Resume",
    // T2: "PDF" broke the pattern (every other row shows a handle) and was
    // inaccurate — the href below is a web page, not a PDF download.
    handle: "/resume",
    href: "https://seansmithdesign.com/resume",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5" />
      </svg>
    ),
  },
];

function App() {
  return (
    <div className="flagship-page">
      {/* T1: the page at rest was an empty paper field with an unnamed
          face on it — no hover (M4), no press (M12), and Sean's name never
          appeared anywhere in the piece. Doubles as the page's <h1>. */}
      <h1 className="flagship-whisper">
        Sean Smith — tap the trigger. Drag it anywhere.
      </h1>
      <Iris.Root className="flagship-theme">
        <Iris.Shadow />

        <Iris.Trigger aria-label="Open contact">
          <Iris.Shared>
            <Portrait />
          </Iris.Shared>
        </Iris.Trigger>

        <Iris.Sheet aria-labelledby="flagship-sheet-title">
          <Iris.Shared>
            <Portrait />
          </Iris.Shared>

          <Iris.Close aria-label="Close" />

          <Iris.Content>
            <Iris.Item>
              <p className="flagship-eyebrow">Open to work · 2026</p>
              <h2 id="flagship-sheet-title" className="flagship-title">
                Let&rsquo;s make something together!
              </h2>
            </Iris.Item>

            <Iris.Item>
              <p className="flagship-tagline">
                Looking for full-time design leadership, and open to advisory.
                Email is fastest.
              </p>
            </Iris.Item>

            <Iris.Item>
              <nav aria-label="Contact links" className="flagship-actions">
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="flagship-action"
                    target={
                      action.href.startsWith("mailto:") ? undefined : "_blank"
                    }
                    rel={
                      action.href.startsWith("mailto:")
                        ? undefined
                        : "noreferrer"
                    }
                  >
                    <span className="flagship-action-icon" aria-hidden="true">
                      {action.icon}
                    </span>
                    <span className="flagship-action-label">
                      {action.label}
                    </span>
                    <span className="flagship-action-handle">
                      {action.handle}
                    </span>
                  </a>
                ))}
              </nav>
            </Iris.Item>

            <Iris.Item>
              <a
                className="flagship-cta"
                href="https://calendar.app.google/bSgz9A1G5FnY6CdD8"
                target="_blank"
                rel="noreferrer"
              >
                book a slot ↗
              </a>
            </Iris.Item>
          </Iris.Content>
        </Iris.Sheet>

        {/* Escape-hatch reuse, unmodified — see example/CloseMask.tsx. */}
        <CloseMask />
      </Iris.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
