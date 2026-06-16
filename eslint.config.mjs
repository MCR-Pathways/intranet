import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noCustomButtonSizing, {
  noIconSizingInsideButton,
  noRedundantBgCardOnOutline,
} from "./eslint-rules/no-custom-button-sizing.mjs";
import { noTruncateWithoutTitle } from "./eslint-rules/a11y-rules.mjs";

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
