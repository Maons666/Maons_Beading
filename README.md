<div align="center">

# 🧩 拼豆图纸生成器

**图片到拼豆，一站式搞定。**

一个纯前端的拼豆图纸生成工具 —— 上传图片，自动匹配主流品牌色板，生成可编辑的色号图 · 分块 PDF 图纸 · 用豆清单。

**所有处理均在浏览器本地完成，图片不会上传到任何服务器。**

[**🚀 在线体验**](https://Maons666.github.io/Maons_Beading/) &nbsp;·&nbsp;
[✨ 功能一览](#-功能一览) &nbsp;·&nbsp;
[🛠 本地运行](#-本地运行) &nbsp;·&nbsp;
[🎨 支持的色板](#-支持的色板)

![vite](https://img.shields.io/badge/Vite-5.x-646cff?logo=vite&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-green)
![tests](https://img.shields.io/badge/tests-70%2F70%20passing-success)
![size](https://img.shields.io/badge/gzip-~150KB-blue)

</div>

---

## ✨ 功能一览

### 🖼️ 图片处理
- 支持 **PNG / JPG / WebP**，最大 10 MB，长边 4000 px
- **自动裁掉透明边**，让主体居中占满画布
- 上传后**按图像长宽比自动预设**图纸尺寸
- 一键**锁定长宽比**，改宽自动改高

### 🎨 色板匹配
- 内置 **5 套主流色板**：MARD 291 · Perler 57 · Hama Midi 53 · Artkal S 159 · 国产常用 74
- 色差算法可切换：
  - **CIEDE2000**（默认，感知精准，处理蓝色/皮肤色更好）
  - **CIE76**（快 ~70×，适合超大图纸预览）
- **颜色数上限**：按用量截取前 N 色，其余映射到最近保留色
- **Floyd–Steinberg 抖动**（可选，适合大幅作品远看）

### ✏️ 图纸编辑
- **笔画**：点击 / 按住拖动，把格子刷成目标色
- **填充**：点一下，把相邻的同色区域整片改色（flood-fill）
- **吸色**：从画布任一格拾取颜色到目标色（按钮 or `Alt+点击` 快捷键）
- **撤销**：`Ctrl/Cmd + Z`，最多回退 100 步
- **色板下拉搜索**：按色号或名称过滤，291 色也能秒选

### 🔍 预览操作
- **滚轮缩放** 0.2× – 4×，以鼠标为锚点
- **鼠标右键拖拽平移**（左键留给编辑）
- **双击复位**视图
- **鼠标悬停**显示格子坐标、色号、名称

### 📤 导出
- **PDF · A4 图纸集**（矢量，可无限缩放清晰）
  - **概况页**：整图色块预览 + 用豆统计表（多栏，含品牌信息）
  - **分块图纸页**：每 40 × 55 一页，含色号 · 网格 · 深色分隔线 · **右上角缩略图**高亮当前块的位置
- **PNG · 色号图**：一张图看清所有色号布局
- **CSV · 用豆清单**：Excel 直接打开，中文正常，含 BOM

### 🎯 其他细节
- **每 5 格深色分隔线**（间距可调），拼装时不容易数错
- **深色/浅色文字自动切换**：色号根据背景明度自动选黑或白
- 全站**无页面滚动**，三栏各自内部滚动，适应各种屏幕尺寸

---

## 🎨 支持的色板

| 色板 | 色数 | 特点 | 数据来源 |
|---|---|---|---|
| **MARD 291** _(默认)_ | 291 | 国内最全，15 系列，覆盖全色相 | [pixel-beads.com](https://www.pixel-beads.com/zh/mard-bead-color-chart) |
| Perler 57 | 57 | 含中文色名，色调偏柔和 | [pixel-beads.com](https://www.pixel-beads.com/zh/perler-bead-color-chart) |
| Hama Midi 53 | 53 | 欧洲工业标准（源站无色名，用色号占位） | [pixel-beads.com](https://www.pixel-beads.com/zh/hama-bead-color-chart) |
| Artkal S 159 | 159 | 英文色名，5 mm 中豆 | [pixel-beads.com](https://www.pixel-beads.com/zh/artkal-bead-color-chart) |
| 国产常用 74 | 74 | 精简版，兼容多品牌主要色号，适合手工快速拼装 | 社区常用色号 + 观测 |

---

## 🛠 本地运行

```bash
git clone https://github.com/Maons666/Maons_Beading.git
cd Maons_Beading
npm install
npm run dev        # 本地开发，自动打开 http://localhost:5173
```

其他命令：

```bash
npm run build      # 打包生产版本到 dist/
npm run preview    # 本地预览打包结果
node test-core.mjs # 核心算法单元测试（70 个测例）
```

---

## 🧱 技术栈

| 领域 | 选型 | 说明 |
|---|---|---|
| 构建 | [Vite 5](https://vitejs.dev/) | 快速开发服务器 + 极小打包体积 |
| 框架 | 原生 JavaScript（无框架） | 简单可控，无学习成本 |
| 渲染 | Canvas 2D API | 处理图像和图纸预览 |
| 色彩 | 自实现 sRGB → LAB + CIEDE2000 | 无第三方色彩库 |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) | 矢量 PDF 导出 |
| 部署 | GitHub Pages + GitHub Actions | 每次 push 自动构建部署 |

---

## 📁 项目结构

```
.
├── index.html                # 页面骨架
├── vite.config.js
├── package.json
├── test-core.mjs             # 算法单元测试
├── .github/workflows/
│   └── deploy.yml            # GitHub Pages 自动部署
└── src/
    ├── main.js               # 应用入口 · UI 与事件编排
    ├── style.css             # 全局样式
    ├── color.js              # RGB/LAB 互转、CIEDE2000、颜色数上限
    ├── image.js              # 图片 → 网格、抖动、透明边裁剪、统计
    ├── render.js             # Canvas 图纸渲染
    ├── export.js             # PNG / CSV 导出
    ├── pdf.js                # PDF 导出（概况页 + 分块图纸页）
    ├── palettes.js           # 色板注册表
    ├── palettes-mard.js      # MARD 291 色
    ├── palettes-perler.js    # Perler 57 色
    ├── palettes-hama.js      # Hama Midi 53 色
    ├── palettes-artkal.js    # Artkal S 159 色
    └── palettes-common.js    # 国产常用 74 色（在 palettes.js 中直接内联）
```

---

## 🗺️ Roadmap

- [ ] 跨品牌色号对照（选一个色号，查它在其它品牌里的最接近替代）
- [ ] 亮度 / 对比度 / 饱和度调整
- [ ] 工程 JSON 存取（保存/载入当前设置）
- [ ] 色板浏览页（可视化查看所有色板）
- [ ] PDF 支持中文色名（嵌入 CJK 字体子集）

欢迎在 [Issues](https://github.com/Maons666/Maons_Beading/issues) 里提建议或反馈问题。

---

## 🙏 致谢

- 色板数据整理自 [pixel-beads.com](https://www.pixel-beads.com/) 的公开色卡
- SVG 图标来自 [Bootstrap Icons](https://icons.getbootstrap.com/)（MIT）
- CIEDE2000 参考 Sharma et al. (2005) 论文与 Bruce Lindbloom 的实现说明

---

## 📄 License

MIT © [Maonster](https://github.com/Maons666)

<div align="center">

_如果这个工具帮到你了，欢迎给个 ⭐️_

</div>
