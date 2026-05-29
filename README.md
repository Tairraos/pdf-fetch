# pdf-fetch（CLI：pdf-fetch）

一个简单的命令行工具：使用 **ImageMagick（magick）** 从 PDF 中提取页面并导出为 JPG。

## 前置条件

- macOS（你当前需求场景）
- 已安装 ImageMagick，并确保命令 `magick` 可用

## 安装

```bash
pnpm add -g pdf-fetch
```

## 使用

无参数时会输出中文使用说明：

```bash
pdf-fetch
```

合并图片目录为 PDF（与导出相反）：

```bash
pdf-fetch -m "./name"
```

转换整个 PDF：

```bash
pdf-fetch "name.pdf"
```

指定分辨率/质量：

```bash
pdf-fetch "name.pdf" -d 200 -q 100
```

指定输出文件名前缀 + 指定页码：

```bash
pdf-fetch "name.pdf" -n "new" -p 10-15,20
```

## 行为规则

- 在 PDF 所在目录创建同名文件夹（去掉 `.pdf` 扩展名），例如 `name.pdf` → `./name/`
- 默认导出所有页面
- 默认 DPI：150（`-d 200` 可改）
- 默认 JPG 质量：95（`-q 100` 可改）
- 默认文件名：`p01.jpg, p02.jpg ...`，序号从 `01` 开始（支持 `-n` 修改前缀，例如 `new01.jpg`）
- 如果目标 JPG 文件已存在：**报错退出**（符合你的覆盖策略要求）
- 合并模式：`-m ./name` 会按文件名顺序（如 `p01.jpg, p02.jpg ...`）合并目录内图片并生成 `./name.pdf`
- 合并模式会以 `p01.jpg`（若存在）作为基准图片尺寸，把后续图片统一处理为同样的像素尺寸，确保每页大小一致
- 合并模式的 `-d/--dpi` 会影响生成 PDF 的页面物理尺寸：建议与导出时的 `-d` 保持一致，这样“解包再合并”更接近原始 PDF
- 合并模式会用基准图片生成 PDF 的首页缩略图（写入到 PDF 首页的 Thumb 字段）

## 开发

```bash
pnpm i
pnpm run lint
pnpm run typecheck
pnpm run build
```
