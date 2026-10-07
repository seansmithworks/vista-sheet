import { VistaSheet } from "../../src/index";

export type SpecimenKind = "disc" | "button" | "sheet";

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SheetBody() {
  return (
    <VistaSheet.Sheet aria-labelledby="surface-sheet-title">
      <VistaSheet.Content>
        <VistaSheet.Close aria-label="Close" />
        <VistaSheet.Item>
          <h2 id="surface-sheet-title">Sean Smith</h2>
        </VistaSheet.Item>
        <VistaSheet.Item>
          <p>Designer. The sheet&apos;s resting shadow is the open look.</p>
        </VistaSheet.Item>
      </VistaSheet.Content>
    </VistaSheet.Sheet>
  );
}

/**
 * One live specimen per iframe (Trigger and Sheet are position: fixed, so
 * each needs its own viewport, as on the canvas). The parent tuner writes
 * every --vista-sheet-* var onto this document's body and sets the theme
 * via body[data-dark-mode] (example/example.css); this file sets none.
 */
export function Stage({ kind }: { kind: SpecimenKind }) {
  const common = {
    defaultAnchor: "center" as const,
    draggable: false,
    persistKey: false as const,
    sheetMaxWidth: 340,
  };

  if (kind === "button") {
    return (
      <VistaSheet.Root {...common} shape="rectangle" buttonSize="m">
        <VistaSheet.Shadow />
        <VistaSheet.Trigger aria-label="New message">
          <PlusIcon />
          New message
        </VistaSheet.Trigger>
        <SheetBody />
      </VistaSheet.Root>
    );
  }

  return (
    <VistaSheet.Root
      {...common}
      triggerSize={96}
      defaultOpen={kind === "sheet"}
    >
      <VistaSheet.Shadow />
      <VistaSheet.Trigger aria-label="Open contact">
        <PlusIcon />
      </VistaSheet.Trigger>
      <SheetBody />
    </VistaSheet.Root>
  );
}
