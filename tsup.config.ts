/**
 * tsup 打包配置
 * 目的：将 TypeScript CLI 编译为可直接运行的 Node 脚本，并注入 shebang。
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  target: "node18",
  sourcemap: true,
  clean: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
