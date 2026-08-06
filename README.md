# 拼豆图纸生成器 · Beading Pattern Maker

本地网页小工具：上传图片 → 生成拼豆图纸（含用豆统计与导出），**不上传任何图片到服务器**，一切在浏览器完成。

## 快速上手

```bash
npm install
npm run dev       # 本地开发，自动打开 http://localhost:5173
npm run build     # 打包到 dist/
npm run preview   # 预览打包结果
```

自测算法：

```bash
node test-core.mjs   # 核心算法单测
```

## 功能

- 图片上传（PNG / JPG / WebP，≤ 10MB，长边 ≤ 4000px）
- 图纸尺寸自定义（8×8 – 200×200 豆），三种适配方式：居中裁剪 / 保持比例 / 拉伸
- 内置色板：**国产常用 73 色**（中文用户常见中豆色号，兼容 Hama/Perler/Artkal）
- 颜色匹配：sRGB → LAB → CIE76 最近色
- 颜色数上限：按用量取前 N 色，其余映射到最近保留色
- Floyd–Steinberg 抖动（可选）
- **可配置的深色分隔线间距**（默认每 5 格，0 = 关闭），实时重绘
- 三视图预览：色块图 / 色号图 / 网格图
- 用豆统计表（色号、名称、数量、占比）
- 鼠标悬停显示格子坐标 + 色号
- 预览滚轮缩放（0.2× – 4×），双击复位
- 导出：
  - **PNG（色号图）** —— 主要图纸输出
  - **CSV（用豆清单）** —— 带 BOM，Excel 直接打开中文正常

## 目录结构

```
Beading/
├── index.html
├── package.json
├── vite.config.js
├── test-core.mjs          # Node 端的算法单元测试
├── reports/               # 分阶段项目报告（git ignored）
└── src/
    ├── main.js            # 主入口 & UI 编排
    ├── style.css          # 全局样式
    ├── palettes.js        # 色板数据
    ├── color.js           # hex/RGB/LAB 转换、色差、最近色、颜色数上限
    ├── image.js           # 图片 → 网格、抖动、用豆统计
    ├── render.js          # Canvas 图纸渲染（含深色分隔线）
    └── export.js          # PNG / CSV 导出
```

## 后续路线

- **M3**：多色板切换（Hama 完整 / Perler / Artkal C·S）、CIEDE2000、跨品牌色号对照
- **M4**：亮度/对比度调节、工程 JSON 存取、色板浏览页
