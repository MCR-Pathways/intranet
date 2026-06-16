/**
 * ESLint rule: no-custom-button-sizing
 *
 * Checks `className` on `<Button>` / `<TooltipButton>` JSX for numeric
 * height/width tokens that should live in the `size` prop instead.
 *
 * Banned patterns (anchored, per-token):
 *   h-<digit>, w-<digit>, h-<digit>.<digit>, w-<digit>.<digit>
 *
 * Skipped patterns (legit non-sizing):
 *   h-full, h-auto, h-fit, h-screen, h-svh, h-lvh, h-dvh
 *   w-full, w-auto, w-fit, w-screen, w-min, w-max
 *
 * Text-size overrides are caught too — all standard Tailwind text-size
 * tokens (xs, sm, base, lg, xl, 2xl–9xl). The `size` prop already sets
 * appropriate text size per variant; overriding `text-*` on className both
 * breaks the variant hierarchy and lets devs bypass the design system via
 * arbitrarily large text.
 *
 * Companion rule: `no-icon-sizing-inside-button` (same file, exported
 * separately) catches the same patterns on JSX children of Button —
 * those slip past this rule because they're not on the Button's own
 * className. See docs/button-system.md.
 */

const BUTTON_COMPONENTS = new Set(["Button", "TooltipButton"]);

// Per-token banned set for the Button itself.
const BUTTON_BANNED_TOKEN_RE =
  /^(h|w)-\d+(\.\d+)?$|^text-(xs|sm|base|lg|xl|[2-9]xl)$/;

// Per-token banned set for icon children of Button: h-X / w-X
// (variant injects [&_svg]:size-X) + mr-X / ml-X (gap-2 handles spacing).
const ICON_CHILD_BANNED_TOKEN_RE = /^(h|w|mr|ml)-\d+(\.\d+)?$/;

function findBannedClass(str, re) {
  for (const cls of str.split(/\s+/)) {
    if (cls && re.test(cls)) return cls;
  }
  return null;
}

/** Extract every string literal from a JSX attribute's value AST. */
function extractStringsFromValue(node) {
  if (!node) return [];
  if (node.type === "Literal" && typeof node.value === "string") {
    return [node.value];
  }
  if (node.type === "JSXExpressionContainer") {
    return extractStringsFromValue(node.expression);
  }
  if (node.type === "TemplateLiteral") {
    return node.quasis.map((q) => q.value.cooked ?? "");
  }
  if (node.type === "CallExpression") {
    // cn("h-7 w-7", other) or clsx("h-7") -- inspect arguments
    return node.arguments.flatMap(extractStringsFromValue);
  }
  if (node.type === "ArrayExpression") {
    return node.elements.flatMap((el) =>
      el ? extractStringsFromValue(el) : [],
    );
  }
  if (node.type === "ConditionalExpression") {
    return [
      ...extractStringsFromValue(node.consequent),
      ...extractStringsFromValue(node.alternate),
    ];
  }
  if (node.type === "LogicalExpression") {
    return extractStringsFromValue(node.right);
  }
  return [];
}

function getClassNameAttr(openingElement) {
  if (!openingElement?.attributes) return null;
  for (const attr of openingElement.attributes) {
    if (attr.type !== "JSXAttribute") continue;
    if (attr.name?.name === "className") return attr;
  }
  return null;
}

/** Walk JSX descendants depth-first, calling `visit` for each JSXElement. */
function walkJsxDescendants(jsxElement, visit) {
  if (!jsxElement.children) return;
  for (const child of jsxElement.children) {
    if (child.type !== "JSXElement") continue;
    visit(child);
    walkJsxDescendants(child, visit);
  }
}

// =============================================
// RULE 1: no-custom-button-sizing
//   className on the Button itself.
//   Severity: error (long-standing rule, 0 existing violations).
// =============================================

const noCustomButtonSizing = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow h-X / w-X / text-size classNames on Button and TooltipButton; use the size prop instead.",
    },
    schema: [],
    messages: {
      customSizing:
        "Do not set sizing classes ({{ match }}) on {{ component }}. Use the `size` prop (icon-xs / icon-sm / icon / sm / default / lg / hero) instead — it handles height, width, and per-size text/SVG sizing for you. See docs/button-system.md.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier") return;
        if (!BUTTON_COMPONENTS.has(nameNode.name)) return;

        const classNameAttr = getClassNameAttr(node);
        if (!classNameAttr) return;
        const strings = extractStringsFromValue(classNameAttr.value);
        for (const s of strings) {
          const match = findBannedClass(s, BUTTON_BANNED_TOKEN_RE);
          if (match) {
            context.report({
              node: classNameAttr,
              messageId: "customSizing",
              data: { match, component: nameNode.name },
            });
            return;
          }
        }
      },
    };
  },
};

// =============================================
// RULE 2: no-icon-sizing-inside-button
//   className on JSX descendants of Button (typically Lucide icons).
//   Banned: h-X, w-X (variant's [&_svg]:size-X handles sizing).
//   Banned: mr-X, ml-X (Button's gap-2 handles spacing).
//   Severity: warn — catches new violations without failing CI on the
//   ~130 existing icon className overrides across the codebase. Move to
//   error after a sweep clears those.
// =============================================

const noIconSizingInsideButton = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow h-X / w-X / mr-X / ml-X classes on JSX children of Button — the size variant injects [&_svg]:size-X and the base className has gap-2.",
    },
    schema: [],
    fixable: "code",
    messages: {
      iconChildSizing:
        "Do not set sizing/margin classes ({{ match }}) on a child of {{ button }}. Button's size variant injects `[&_svg]:size-X` and the base className has `gap-2` — explicit h-X / w-X / mr-X / ml-X on icons is redundant. See docs/button-system.md.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier") return;
        if (!BUTTON_COMPONENTS.has(nameNode.name)) return;

        const parentEl = node.parent;
        if (parentEl?.type !== "JSXElement") return;

        walkJsxDescendants(parentEl, (childEl) => {
          const classNameAttr = getClassNameAttr(childEl.openingElement);
          if (!classNameAttr) return;
          const strings = extractStringsFromValue(classNameAttr.value);
          for (const s of strings) {
            const match = findBannedClass(s, ICON_CHILD_BANNED_TOKEN_RE);
            if (match) {
              context.report({
                node: classNameAttr,
                messageId: "iconChildSizing",
                data: { match, button: nameNode.name },
                // Autofix only for plain string literal classNames:
                //   className="h-4 w-4 text-muted-foreground"  → fixable
                //   className={cn("h-4 w-4", maybeOther)}      → not fixable (skip)
                // Drops banned tokens, keeps the rest. If nothing remains,
                // removes the entire className attribute.
                fix(fixer) {
                  const valueNode = classNameAttr.value;
                  if (
                    !valueNode ||
                    valueNode.type !== "Literal" ||
                    typeof valueNode.value !== "string"
                  ) {
                    return null;
                  }
                  const kept = valueNode.value
                    .split(/\s+/)
                    .filter(
                      (t) => t && !ICON_CHILD_BANNED_TOKEN_RE.test(t),
                    );
                  if (kept.length === 0) {
                    // Remove the className attribute entirely, including any
                    // leading whitespace so we don't leave `<Save  />`.
                    const sourceCode = context.sourceCode ?? context.getSourceCode();
                    const before = sourceCode.getTokenBefore(classNameAttr);
                    const start = before ? before.range[1] : classNameAttr.range[0];
                    return fixer.removeRange([start, classNameAttr.range[1]]);
                  }
                  return fixer.replaceText(
                    valueNode,
                    JSON.stringify(kept.join(" ")),
                  );
                },
              });
              return;
            }
          }
        });
      },
    };
  },
};

// =============================================
// RULE 3: no-bg-card-on-outline-button
//   The `outline` Button variant fills bg-card natively (ADR-014), so an
//   explicit `bg-card` token on a variant="outline" Button is redundant dead
//   weight. AST-based, so it catches single-line AND multi-line JSX (the kind
//   a single-line grep misses). Matches the exact `bg-card` token only —
//   `bg-card/90` (frosted floating controls) and bg-card on inputs/dialogs are
//   left alone. Severity: error (0 violations after the P3-F sweep).
//   See docs/button-system.md.
// =============================================

/** True if this opening element has a literal variant="outline". */
function hasOutlineVariant(openingElement) {
  if (!openingElement?.attributes) return false;
  for (const attr of openingElement.attributes) {
    if (attr.type !== "JSXAttribute") continue;
    if (attr.name?.name !== "variant") continue;
    const v = attr.value;
    if (v?.type === "Literal" && v.value === "outline") return true;
    if (
      v?.type === "JSXExpressionContainer" &&
      v.expression?.type === "Literal" &&
      v.expression.value === "outline"
    ) {
      return true;
    }
    return false; // variant present but dynamic / non-outline — don't flag
  }
  return false; // no variant attr → default variant, not outline
}

const noRedundantBgCardOnOutline = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow the redundant `bg-card` className token on outline Buttons — the outline variant fills bg-card natively (ADR-014).",
    },
    schema: [],
    fixable: "code",
    messages: {
      redundantBgCard:
        '`bg-card` is redundant on a variant="outline" {{ component }} — the outline variant fills bg-card natively (ADR-014). Remove it. See docs/button-system.md.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const nameNode = node.name;
        if (nameNode.type !== "JSXIdentifier") return;
        if (!BUTTON_COMPONENTS.has(nameNode.name)) return;
        if (!hasOutlineVariant(node)) return;

        const classNameAttr = getClassNameAttr(node);
        if (!classNameAttr) return;
        const strings = extractStringsFromValue(classNameAttr.value);
        const hasBgCard = strings.some((s) =>
          s.split(/\s+/).includes("bg-card"),
        );
        if (!hasBgCard) return;

        context.report({
          node: classNameAttr,
          messageId: "redundantBgCard",
          data: { component: nameNode.name },
          // Autofix only for plain string-literal classNames: drop the
          // `bg-card` token, keep the rest; remove the attribute if empty.
          fix(fixer) {
            const valueNode = classNameAttr.value;
            if (
              !valueNode ||
              valueNode.type !== "Literal" ||
              typeof valueNode.value !== "string"
            ) {
              return null;
            }
            const kept = valueNode.value
              .split(/\s+/)
              .filter((t) => t && t !== "bg-card");
            if (kept.length === 0) {
              const sourceCode = context.sourceCode ?? context.getSourceCode();
              const before = sourceCode.getTokenBefore(classNameAttr);
              const start = before
                ? before.range[1]
                : classNameAttr.range[0];
              return fixer.removeRange([start, classNameAttr.range[1]]);
            }
            return fixer.replaceText(valueNode, JSON.stringify(kept.join(" ")));
          },
        });
      },
    };
  },
};

// Default export keeps the existing rule registration working unchanged.
export default noCustomButtonSizing;
export { noIconSizingInsideButton, noRedundantBgCardOnOutline };
