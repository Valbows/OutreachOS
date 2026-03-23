import { config as baseConfig } from "../eslint-config/base.js";

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
];
