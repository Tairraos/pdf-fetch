/**
 * 给生成后的 CLI 文件注入 shebang（#!/usr/bin/env node）
 * 目的：确保全局安装后可直接作为可执行命令运行。
 */

const fs = require("node:fs");

/**
 * @param {string} filePath
 * @returns {void}
 */
function addShebang(filePath) {
  const shebang = "#!/usr/bin/env node\n";
  const content = fs.readFileSync(filePath, "utf8");
  if (content.startsWith(shebang)) return;
  fs.writeFileSync(filePath, shebang + content, "utf8");
}

const target = process.argv[2];
if (!target) {
  console.error("用法：node scripts/add-shebang.cjs <目标文件>");
  process.exit(1);
}

addShebang(target);
