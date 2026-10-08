import { createElement, type ReactNode, type RefObject } from "react";
import { Iris } from "../../src/index";
import { INITIAL_FOCUS_PROP, type PlayNode } from "./recipes";

type PropValue = string | number | boolean;
type RootOverrides = Record<string, unknown>;

function isText(node: PlayNode): node is { text: string } {
  return "text" in node;
}

/** True if `node` or any descendant carries INITIAL_FOCUS_PROP — computed
 * once per render so the ancestor <Iris.Sheet> knows to wire
 * `initialFocus` before the marked descendant is even reached. */
function hasInitialFocusMarker(node: PlayNode): boolean {
  if (isText(node)) return false;
  if (node.props.some(([name]) => name === INITIAL_FOCUS_PROP)) return true;
  return node.children.some(hasInitialFocusMarker);
}

function resolveComponent(type: string): unknown {
  const prefix = "Iris.";
  if (type.startsWith(prefix)) {
    const name = type.slice(prefix.length) as keyof typeof Iris;
    return Iris[name];
  }
  return type;
}

function propsToObject(
  props: Array<[string, PropValue]>,
): Record<string, PropValue> {
  const obj: Record<string, PropValue> = {};
  for (const [name, value] of props) obj[name] = value;
  return obj;
}

/**
 * Renders the same `PlayNode` tree the codegen printer serialises to JSX —
 * one model drives both the specimen and the copy output (Strawman (v0.2)),
 * so drift between what's shown and what's copied is structurally
 * impossible. `rootOverrides` merge onto the outermost `Iris.Root`
 * only (the playground's own render-time wiring — id, persistKey,
 * onAnchorChange — which the printer never emits). `rendererChildren` are
 * appended after the root's codegen children (e.g. `AnchorSync`) — a
 * renderer-only slot the copy printer never sees.
 */
export function renderPlayTree(
  node: PlayNode,
  rootOverrides: RootOverrides = {},
  rendererChildren: ReactNode[] = [],
  /** Wired onto the marked recipe field (INITIAL_FOCUS_PROP) as its DOM ref,
   * and onto the ancestor <Iris.Sheet> as `initialFocus` — Search and
   * Chat's recipes are the only ones that mark a field; every other recipe
   * renders exactly as it did before (the panel keeps focus at settle). */
  initialFocusRef?: RefObject<HTMLElement | null>,
): ReactNode {
  const needsInitialFocus = hasInitialFocusMarker(node);
  return renderNode(
    node,
    rootOverrides,
    true,
    "root",
    rendererChildren,
    initialFocusRef,
    needsInitialFocus,
  );
}

/**
 * Children are keyed by element type + ordinal among siblings of that type
 * (not raw index): inserting or removing a sibling of a different type (the
 * Shadow toggle, a recipe's optional slot node) must not shift every later
 * sibling's key, or React remounts them along with it.
 */
function renderNode(
  node: PlayNode,
  rootOverrides: RootOverrides,
  isRoot: boolean,
  key: string,
  rendererChildren: ReactNode[],
  initialFocusRef: RefObject<HTMLElement | null> | undefined,
  needsInitialFocus: boolean,
): ReactNode {
  if (isText(node)) return node.text;

  const marked = node.props.some(([name]) => name === INITIAL_FOCUS_PROP);
  const domProps = marked
    ? node.props.filter(([name]) => name !== INITIAL_FOCUS_PROP)
    : node.props;
  const component = resolveComponent(node.type);
  const props: Record<string, unknown> = propsToObject(domProps);
  if (isRoot) Object.assign(props, rootOverrides);
  if (marked && initialFocusRef) props.ref = initialFocusRef;
  if (
    node.type === "Iris.Sheet" &&
    needsInitialFocus &&
    initialFocusRef
  ) {
    props.initialFocus = initialFocusRef;
  }

  const seen = new Map<string, number>();
  const children = node.children.map((child) => {
    const kind = isText(child) ? "text" : child.type;
    const ordinal = seen.get(kind) ?? 0;
    seen.set(kind, ordinal + 1);
    return renderNode(
      child,
      rootOverrides,
      false,
      `${kind}:${ordinal}`,
      [],
      initialFocusRef,
      needsInitialFocus,
    );
  });
  if (isRoot) children.push(...rendererChildren);

  return createElement(component as never, { key, ...props }, ...children);
}
