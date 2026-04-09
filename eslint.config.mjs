import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

import uxPlugin from "./tools/eslint-plugin-ux-standards.mjs"

export default tseslint.config(
  {
    ignores: [
      ".react-router/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "worker-configuration.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "tests/**/*.{js,jsx,ts,tsx}",
      "tools/**/*.{js,mjs,cjs}",
      "playwright.config.ts",
      "eslint.config.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      ux: uxPlugin,
    },
    rules: {
      "no-warning-comments": ["error", { terms: ["todo"], location: "anywhere" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      ux: uxPlugin,
    },
    rules: {
      "no-warning-comments": ["error", { terms: ["todo"], location: "anywhere" }],
      "ux/no-hex-colors": "error",
      "ux/enforce-motion-durations": "error",
      "ux/enforce-4px-grid": "error",
    },
  }
)
