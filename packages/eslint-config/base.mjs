import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [".next/**", "dist/**", "node_modules/**"],
  },
];
