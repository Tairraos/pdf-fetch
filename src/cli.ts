/**
 * pdf-fetch CLI 入口
 * 功能：使用已安装的 ImageMagick（magick）从 PDF 中提取页面并保存为 JPG。
 */

import { Command } from "commander";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Options = {
  dpi: number;
  quality: number;
  name: string;
  pages?: string;
};

/**
 * 输出中文使用说明（无参数时）。
 * @returns {void}
 */
function printChineseUsage(): void {
  const text = `
用法：
  pdf-fetch "文件.pdf" [选项]

说明：
  - 在 PDF 所在目录创建同名文件夹（去掉 .pdf 扩展名）
  - 将指定页面导出为 JPG，文件名规则：前缀 + 序号（从 01 开始）

选项：
  -d, --dpi <数字>       分辨率（DPI），默认 150
  -q, --quality <数字>   JPG 质量，默认 95
  -n, --name <前缀>      文件名前缀，默认 p（示例：p01.jpg）
  -p, --pages <范围>     选择页面：
                         -p 10            第 10 页
                         -p 10,12,13      第 10/12/13 页
                         -p 10-15         第 10 到 15 页
                         -p 10-15,20      第 10-15 页和第 20 页

示例：
  pdf-fetch "name.pdf"
  pdf-fetch "name.pdf" -d 200 -q 100
  pdf-fetch "name.pdf" -n "new" -p 10-15,20
`;
  console.log(text.trim());
}

/**
 * 将数字按指定宽度补零。
 * @param {number} n 数字
 * @param {number} width 宽度
 * @returns {string} 补零后的字符串
 */
function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * 解析页码参数（如：10 / 10,12,13 / 10-15 / 10-15,20）。
 * @param {string} spec 页码表达式
 * @returns {number[]} 页码数组（从 1 开始）
 */
function parsePagesSpec(spec: string): number[] {
  const raw = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const pages: number[] = [];

  for (const part of raw) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end <= 0) {
        throw new Error(`页码范围非法：${part}`);
      }
      if (start > end) {
        throw new Error(`页码范围起止顺序错误：${part}`);
      }
      for (let i = start; i <= end; i += 1) pages.push(i);
      continue;
    }

    const singleMatch = part.match(/^\d+$/);
    if (singleMatch) {
      const v = Number(part);
      if (!Number.isInteger(v) || v <= 0) throw new Error(`页码非法：${part}`);
      pages.push(v);
      continue;
    }

    throw new Error(`无法解析页码参数：${part}`);
  }

  // 去重 + 排序（保证输出顺序稳定）
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

/**
 * 检查 magick 命令是否可用。
 * @returns {Promise<void>}
 */
async function ensureMagickAvailable(): Promise<void> {
  try {
    await execFileAsync("magick", ["-version"]);
  } catch {
    throw new Error("未检测到 ImageMagick 的 magick 命令。请确认已安装并且在 PATH 中可用。");
  }
}

/**
 * 获取 PDF 页数。
 * 实现：通过 `magick identify -ping file.pdf` 输出行数判断。
 * @param {string} pdfPath PDF 路径
 * @returns {Promise<number>} 页数
 */
async function getPdfPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync("magick", ["identify", "-ping", pdfPath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  const lines = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("无法识别 PDF 页数（magick identify 输出为空）。");
  return lines.length;
}

/**
 * 将指定 PDF 页面导出为 JPG。
 * @param {object} params 参数
 * @param {string} params.pdfPath PDF 路径
 * @param {number} params.pageNumber PDF 页码（从 1 开始）
 * @param {number} params.dpi 分辨率 DPI
 * @param {number} params.quality JPG 质量
 * @param {string} params.outputPath 输出文件路径
 * @returns {Promise<void>}
 */
async function convertSinglePageToJpg(params: {
  pdfPath: string;
  pageNumber: number;
  dpi: number;
  quality: number;
  outputPath: string;
}): Promise<void> {
  const magickPageIndex = params.pageNumber - 1; // ImageMagick 以 0 为第一页索引
  await execFileAsync(
    "magick",
    [
      "-density",
      String(params.dpi),
      `${params.pdfPath}[${magickPageIndex}]`,
      "-quality",
      String(params.quality),
      params.outputPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
}

/**
 * 主流程：解析参数并执行转换。
 * @param {string} inputPdf 用户输入的 PDF 路径（可相对/绝对）
 * @param {Options} options 命令行选项
 * @returns {Promise<void>}
 */
async function run(inputPdf: string, options: Options): Promise<void> {
  if (!existsSync(inputPdf)) {
    throw new Error(`找不到文件：${inputPdf}`);
  }

  await ensureMagickAvailable();

  const pdfAbsPath = path.resolve(process.cwd(), inputPdf);
  const pdfDir = path.dirname(pdfAbsPath);
  const pdfBaseName = path.basename(pdfAbsPath, path.extname(pdfAbsPath));
  const outputDir = path.join(pdfDir, pdfBaseName);

  if (existsSync(outputDir)) {
    const st = await stat(outputDir);
    if (!st.isDirectory()) {
      throw new Error(`输出路径已存在但不是文件夹：${outputDir}`);
    }
  } else {
    await mkdir(outputDir, { recursive: true });
  }

  const pageCount = await getPdfPageCount(pdfAbsPath);
  const selectedPages = options.pages ? parsePagesSpec(options.pages) : [];
  const pages =
    selectedPages.length > 0 ? selectedPages : Array.from({ length: pageCount }, (_, i) => i + 1);

  const invalidPage = pages.find((p) => p < 1 || p > pageCount);
  if (invalidPage) {
    throw new Error(`页码超出范围：${invalidPage}（PDF 总页数：${pageCount}）`);
  }

  const width = Math.max(2, String(pages.length).length);

  for (let i = 0; i < pages.length; i += 1) {
    const outIndex = i + 1; // 输出序号从 1 开始
    const fileName = `${options.name}${padNumber(outIndex, width)}.jpg`;
    const outputPath = path.join(outputDir, fileName);

    if (existsSync(outputPath)) {
      throw new Error(`输出文件已存在，已按要求中止：${outputPath}`);
    }

    const pageNumber = pages[i];
    console.log(`正在转换：第 ${pageNumber} 页 -> ${fileName}`);
    await convertSinglePageToJpg({
      pdfPath: pdfAbsPath,
      pageNumber,
      dpi: options.dpi,
      quality: options.quality,
      outputPath,
    });
  }

  console.log(`完成：共导出 ${pages.length} 张 JPG，输出目录：${outputDir}`);
}

async function main(): Promise<void> {
  if (process.argv.slice(2).length === 0) {
    printChineseUsage();
    process.exit(0);
  }

  const program = new Command();

  program
    .name("pdf-fetch")
    .description("从 PDF 中提取页面并保存为 JPG（依赖 ImageMagick：magick）")
    .argument("<pdf>", "PDF 文件路径")
    .option("-d, --dpi <number>", "分辨率（DPI），默认 150", "150")
    .option("-q, --quality <number>", "JPG 质量，默认 95", "95")
    .option("-n, --name <string>", "输出文件名前缀，默认 p", "p")
    .option("-p, --pages <string>", "页码选择（如 10-15,20）");

  program.parse(process.argv);

  const inputPdf = program.args[0] as string | undefined;
  if (!inputPdf) {
    printChineseUsage();
    process.exit(1);
  }

  const opts = program.opts<Options>();
  const dpi = Number(opts.dpi);
  const quality = Number(opts.quality);

  if (!Number.isFinite(dpi) || dpi <= 0) throw new Error("dpi 必须是大于 0 的数字。");
  if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
    throw new Error("quality 必须是 1-100 之间的数字。");
  }
  if (!opts.name || opts.name.trim().length === 0) throw new Error("name 不能为空。");

  await run(inputPdf, {
    dpi,
    quality,
    name: opts.name.trim(),
    pages: opts.pages?.trim(),
  });
}

main().catch((err) => {
  console.error(`错误：${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
