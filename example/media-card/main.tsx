import { createRoot } from "react-dom/client";
import { Iris, presets } from "../../src/index";
import "./media-card.css";

// The whole point of this example: the SAME icon renders in both
// <Iris.Shared> slots (trigger-side and sheet-side). The package's
// FLIP morph animates one continuous element between them, so what you
// tapped does not get replaced by an unrelated panel — it grows INTO the
// card's own icon. A modal opening over the trigger cannot do this; that
// continuity is the "why" this example exists to show.
function AppIcon() {
  return (
    <div className="media-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="9" width="2.4" height="6" rx="1.2" />
        <rect x="6.4" y="5" width="2.4" height="14" rx="1.2" />
        <rect x="10.8" y="2.5" width="2.4" height="19" rx="1.2" />
        <rect x="15.2" y="6.5" width="2.4" height="11" rx="1.2" />
        <rect x="19.6" y="10" width="2.4" height="4" rx="1.2" />
      </svg>
    </div>
  );
}

function App() {
  return (
    <div className="media-page">
      <p className="media-whisper">
        Tap the icon — it becomes the card&rsquo;s icon, not a new one.
      </p>

      {/* Dogfoods the preset API (Phase 1): `snappy` in place of hand-typed
          spring numbers, exactly what presets exist to avoid. */}
      {/* 72px squircle: reads as an App Store app icon, not a play button.
          The sheet-side Shared copy resolves to the same size and the same
          squircle mask, so the trigger-to-card morph has no shape pop. */}
      <Iris.Root
        className="media-theme"
        preset={presets.snappy}
        shape="squircle"
        triggerSize={72}
      >
        <Iris.Shadow />

        <Iris.Trigger aria-label="Open Wavelength preview">
          <Iris.Shared>
            <AppIcon />
          </Iris.Shared>
        </Iris.Trigger>

        <Iris.Sheet aria-labelledby="media-card-title">
          <Iris.Shared>
            <AppIcon />
          </Iris.Shared>

          <Iris.Close aria-label="Close" />

          <Iris.Content>
            <Iris.Item>
              <div className="media-header">
                <div>
                  <h2 id="media-card-title" className="media-title">
                    Wavelength
                  </h2>
                  <p className="media-subtitle">Podcasts, tuned to you</p>
                </div>
                <a
                  className="media-get"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  GET
                </a>
              </div>
            </Iris.Item>

            <Iris.Item>
              <dl className="media-meta">
                <div className="media-meta-stat">
                  <dt>Rating</dt>
                  <dd>4.8 &#9733;</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Reviews</dt>
                  <dd>2.1k</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Category</dt>
                  <dd>Music</dd>
                </div>
                <div className="media-meta-stat">
                  <dt>Age</dt>
                  <dd>4+</dd>
                </div>
              </dl>
            </Iris.Item>

            <Iris.Item>
              <p className="media-description">
                Wavelength surfaces the five episodes you&rsquo;d actually
                finish today, not the five hundred you saved. No feed to scroll,
                just a queue that ends.
              </p>
            </Iris.Item>
          </Iris.Content>
        </Iris.Sheet>
      </Iris.Root>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
