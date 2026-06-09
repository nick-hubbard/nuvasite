import nextPlugin from "@next/eslint-plugin-next";
import { config as baseConfig } from "./base.mjs";

export const config = [
  ...baseConfig,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
