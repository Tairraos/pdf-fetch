/**
 * ESLint 配置（Flat Config）
 * 目的：保证 TS/JS 代码质量，并与 Prettier 规则兼容。
 */

const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

module.exports = [
  // 说明：配置文件本身不参与 lint，避免 Node/CommonJS 全局变量报错
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.js", "prettier.config.cjs"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
    },
    rules: {
      "no-console": "off",
    },
  },
];
