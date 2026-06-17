import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noCustomButtonSizing, {
  noIconSizingInsideButton,
  noRedundantBgCardOnOutline,
} from "./eslint-rules/no-custom-button-sizing.mjs";
import { noTruncateWithoutTitle } from "./eslint-rules/a11y-rules.mjs";
import jsxA11y from "eslint-plugin-jsx-a11y";

// ── jsx-a11y rule policy (ADR-012) ────────────────────────────────────────────
// Apply the recommended ruleset PROPERLY, reusing Next's plugin registration
// (re-registering the plugin silently no-ops the rules). An earlier version did
// `Object.keys(recommended.rules) → "warn"`, which stripped each rule's
// recommended options (e.g. control-has-associated-label's `ignoreElements`) and
// force-enabled off-by-default rules — inflating the sweep with false positives
// while downgrading 24 already-clean error-rules to warn. CRITICAL: a
// severity-only override replaces a rule's options, so every override below
// respecifies `[severity, ...recommendedOptions]`.
const A11Y_RECOMMENDED = jsxA11y.flatConfigs.recommended.rules;
const a11yOpts = (rule) => {
  const cfg = A11Y_RECOMMENDED[rule];
  return Array.isArray(cfg) ? cfg.slice(1) : [];
};
// Rules with a remaining violation backlog: held at `warn` until each slice is
// swept to zero, then promoted to `error`. Everything else recommended-on is
// already clean and goes straight to `error`.
const A11Y_SWEEP_AT_WARN = new Set([
  "jsx-a11y/no-autofocus",
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/label-has-associated-control",
  "jsx-a11y/media-has-caption",
  "jsx-a11y/iframe-has-title",
  "jsx-a11y/no-noninteractive-tabindex",
]);
function buildA11yRules() {
  const rules = {};
  for (const [rule, cfg] of Object.entries(A11Y_RECOMMENDED)) {
    // Off-by-default rules stay off (label-has-for is deprecated;
    // anchor-ambiguous-text; control-has-associated-label is re-enabled below).
    if ((Array.isArray(cfg) ? cfg[0] : cfg) === "off") continue;
    rules[rule] = [
      A11Y_SWEEP_AT_WARN.has(rule) ? "warn" : "error",
      ...a11yOpts(rule),
    ];
  }
  // Deliberately enable control-has-associated-label (off in recommended) WITH
  // its options: with them it ignores form inputs (input/textarea/video) and
  // flags only genuine nameless controls, e.g. icon-only buttons.
  rules["jsx-a11y/control-has-associated-label"] = [
    "error",
    ...a11yOpts("jsx-a11y/control-has-associated-label"),
  ];
  return rules;
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "mcr-button": {
        rules: {
          "no-custom-button-sizing": noCustomButtonSizing,
          "no-icon-sizing-inside-button": noIconSizingInsideButton,
          "no-bg-card-on-outline": noRedundantBgCardOnOutline,
        },
      },
      "mcr-a11y": {
        rules: {
          "no-truncate-without-title": noTruncateWithoutTitle,
        },
      },
    },
    rules: {
      // Flag unused variables as errors (allow underscore prefix for intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Prefer const over let when variable is never reassigned
      "prefer-const": "error",
      // No console.log in production code (warn only — allow console.error/warn)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // No h-X / w-X className on Button / TooltipButton — use the `size`
      // prop. See docs/button-system.md. The override block below exempts
      // files with pre-existing violations; each sweep PR removes its
      // files as they clean up.
      "mcr-button/no-custom-button-sizing": "error",
      // Icon classNames inside Button (h-X / w-X / mr-X / ml-X) — the size
      // variant injects [&_svg]:size-X and the base className has gap-2, so
      // any of these on an icon child are redundant. Started as `warn` while
      // the codebase had ~130 existing violations; promoted to `error` after
      // the sweep cleared them all via the rule's autofix.
      "mcr-button/no-icon-sizing-inside-button": "error",
      // Redundant `bg-card` on a variant="outline" Button — the outline
      // variant fills bg-card natively (ADR-014). AST-based, so it catches
      // multi-line JSX a single-line grep misses. Error from day one (the
      // P3-F sweep cleared all existing instances).
      "mcr-button/no-bg-card-on-outline": "error",
      // Truncated text (truncate / line-clamp-N) without a `title` is
      // unreadable on hover for sighted users. Starts as `warn` while the
      // existing sites are swept; promote to `error` once clear (the
      // no-icon-sizing-inside-button playbook). See .claude/rules/ui-components.md.
      "mcr-a11y/no-truncate-without-title": "warn",
    },
  },
  {
    // jsx-a11y enforcement, built by buildA11yRules() above (ADR-012):
    // recommended options preserved, already-clean rules at `error`, backlog
    // rules at `warn` until swept, control-has-associated-label on with options.
    files: ["src/**/*.{ts,tsx}"],
    rules: buildA11yRules(),
  },
  {
    // CLI scripts legitimately use console.log
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
