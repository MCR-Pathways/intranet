import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noCustomButtonSizing from "./eslint-rules/no-custom-button-sizing.mjs";

// Files that still have button-sizing violations at the time this rule
// lands. Each sweep PR (2, 3, 4) removes its files from this list as
// they clean up. PR 5 verifies this list is empty.
const BUTTON_SIZING_OVERRIDE_FILES = [
  "src/components/news-feed/comment-item.tsx",
  "src/components/news-feed/comment-section.tsx",
  "src/components/news-feed/poll-composer.tsx",
  "src/components/news-feed/post-card.tsx",
  "src/components/sign-in/calendar-sync-status.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "mcr-button": {
        rules: {
          "no-custom-button-sizing": noCustomButtonSizing,
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
    },
  },
  {
    files: BUTTON_SIZING_OVERRIDE_FILES,
    rules: {
      "mcr-button/no-custom-button-sizing": "off",
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
