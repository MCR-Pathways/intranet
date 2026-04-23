/**
 * ESLint rule: no-custom-button-sizing
 *
 * Flags `<Button>` / `<TooltipButton>` JSX with `className` containing
 * numeric height/width tokens that should live in the `size` prop instead.
 *
 * Banned patterns (word-bounded digit suffixes):
 *   h-<digit>, w-<digit>, h-<digit>.<digit>, w-<digit>.<digit>
 *
 * Skipped patterns (legit non-sizing):
 *   h-full, h-auto, h-fit, h-screen, h-svh, h-lvh, h-dvh
 *   w-full, w-auto, w-fit, w-screen, w-min, w-max
 *
 * The rule supports conditional classNames too, because devs sometimes
 * wrap a string literal in `cn(...)` or use ternaries. We walk template
 * literals and array / call-expression argument strings.
 *
 * Text-size overrides are caught here too: all standard Tailwind text-size
 * tokens (xs, sm, base, lg, xl, 2xl–9xl). The `size` prop already sets
 * appropriate text size per variant; overriding `text-*` on className both
 * breaks the variant hierarchy and lets devs bypass the design system via
 * arbitrarily large text.
 */

const BUTTON_COMPONENTS = new Set(["Button", "TooltipButton"]);
// Per-token banned set: standalone `h-<digits>` / `w-<digits>` sizing, plus
// every standard Tailwind text-size token (xs..9xl). Splitting the className
// by whitespace before testing each token against the anchored regex avoids
// false positives on prefixed forms (`min-h-4`, `max-w-10`, `min-w-full`,
// `text-muted-foreground`, etc.) — a word-boundary regex would otherwise
// match inside those.
const BANNED_TOKEN_RE =
  /^(h|w)-\d+(\.\d+)?$|^text-(xs|sm|base|lg|xl|[2-9]xl)$/;

function findBannedSizingClass(str) {
  for (const cls of str.split(/\s+/)) {
    if (cls && BANNED_TOKEN_RE.test(cls)) return cls;
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
      el ? extractStringsFromValue(el) : []
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

const rule = {
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

        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          if (!attr.name || attr.name.name !== "className") continue;

          const strings = extractStringsFromValue(attr.value);
          for (const s of strings) {
            const match = findBannedSizingClass(s);
            if (match) {
              context.report({
                node: attr,
                messageId: "customSizing",
                data: {
                  match,
                  component: nameNode.name,
                },
              });
              return; // one report per Button is enough
            }
          }
        }
      },
    };
  },
};

export default rule;
