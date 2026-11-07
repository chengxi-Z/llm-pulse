# AI Pulse · 照胆云 — v1.1 UI 设计规范（UI-SPEC）

> 状态：v1.2 增量（v1.1 定稿后扩展，2026-11-03）｜ 对应契约：`docs/V1.1-CONTRACT.md` §2 + `docs/V1.2-CONTRACT.md` §2/§3/§5
> 适用文件：`site/assets/css/{theme,base,components,assistant,share}.css`；本文是 CSS 的唯一设计说明，实现以 CSS 为准。
> 视觉关键词：**轻奢杂志感**——克制、留白、细线、金属色点睛；五套主题结构一致、气质可辨识、正文均可读。
> v1.2 新增：首页数据仪表盘、技能页/引导 modal、分享卡地址区、订阅地址/关于二维码/项目 Skills 支撑块（见 §15–§20）。

---

## 1. 设计原则

1. **结构恒定，皮肤可换**：所有主题共用同一套排版、间距、圆角、动效与组件结构，只换调色板与强调色；切换主题不改变信息层级。
2. **颜色 100% token 化**：组件禁止出现十六进制颜色；所有颜色来自 `theme.css` 的调色板 token 或由 `rgb(var(--rgb-*))` 派生的着色。
3. **金色是金属，不是主色块**：金色只做细线、小标签、图标、描边与按钮填充；正文永远用墨色。主按钮禁止大面积纯黑填充（v1.0 用户痛点）。
4. **每套主题有自己的强调色**：`--highlight` 用于标题高亮字、栏目标签、链接、回顶箭头、焦点环，让 jade / rose / graphite 不只是"背景微色差"。
5. **动效克制**：≤240ms、单一缓动曲线（`--ease`）；`prefers-reduced-motion` 全量降级。
6. **移动端优先可用**：360/390 无横向溢出；header 的主题/语言/菜单入口同排；表格横向滚动不破坏全局滚动条样式。

---

## 2. 主题清单与色板

### 2.1 主题总览

| id | 名称 | 气质 | 主按钮 | 强调色 `--highlight` |
|---|---|---|---|---|
| `ivory` | 纸墨雅金（默认） | 米白纸感、衬线、香槟金 | 香槟金填充 + 墨色文字 | 香槟金 `#87652F` |
| `noir` | 深夜鎏金（暗） | 黑金、博物馆夜展 | 亮金填充 + 深墨文字 | 亮金 `#D3B164` |
| `jade` | 青瓷墨绿（浅） | 青瓷、茶室、清冷高级 | 墨绿填充 + 浅色文字 | 青瓷墨绿 `#3F6B57` |
| `rose` | 暮云玫瑰（浅） | 暮色、香槟粉、柔奢 | 豆沙玫瑰填充 + 浅色文字 | 豆沙玫瑰 `#8A5D67` |
| `graphite` | 极简石墨（浅） | 建筑感、冷灰、克制 | 石墨灰填充 + 浅色文字 | 石墨 `#55534E` |
| `auto` | 跟随系统 | 由 `prefers-color-scheme` 在 ivory / noir 间解析 | 同解析结果 | 同解析结果 |

> 规则：`auto` **只**在 ivory / noir 之间解析；手动选 jade / rose / graphite 时为固定主题（不随系统变化）。

### 2.2 调色板 token（`site/assets/css/theme.css`）

| token | ivory | noir | jade | rose | graphite |
|---|---|---|---|---|---|
| `--bg` 页面底 | `#F6F1E9` | `#0E0D0B` | `#EEF2EC` | `#F6EDEA` | `#F3F2EF` |
| `--surface` 卡面 | `#FFFDF9` | `#171411` | `#FBFCF9` | `#FFFCFB` | `#FAFAF8` |
| `--surface-2` 次级面 | `#F1EADE` | `#1D1916` | `#E6EBE3` | `#F0E2DE` | `#EAE9E5` |
| `--ink` 正文 | `#14100C` | `#F2ECE2` | `#17211B` | `#1D1517` | `#171717` |
| `--ink-soft` 次级正文 | `#2F281F` | `#DDD4C6` | `#2A3830` | `#3A2C2F` | `#2A2A28` |
| `--muted` 辅文 | `#6B6257` | `#A79B8A` | `#5C665F` | `#6E5F63` | `#66655F` |
| `--gold` 金属色 | `#B08A4F` | `#C9A227` | `#A98C55` | `#B08A4F` | `#8C8A85` |
| `--gold-soft` 细线/浅金 | `#D9C39A` | `#8A743F` | `#D5C8A9` | `#DFCBB4` | `#C9C7C1` |
| `--gold-deep` 金属文字 | `#87652F` | `#D3B164` | `#6F5A31` | `#85653B` | `#4A4844` |
| `--highlight` 主题强调 | `#87652F` | `#D3B164` | `#3F6B57` | `#8A5D67` | `#55534E` |
| `--line` 分割线 | `#E4D9C6` | `#2A251E` | `#DAE0D5` | `#E8D5D1` | `#E3E1DC` |
| `--line-strong` 强线 | `#D2C2A6` | `#3A332A` | `#C8D1C3` | `#D9BFBA` | `#CFCDC7` |
| `--accent` 次强调 | `#12312A` | `#5E8B74` | `#3F6B57` | `#8A5D67` | `#2A2A28` |
| `--danger` | `#9C4A33` | `#D08A74` | `#8F4B3A` | `#9C4A33` | `#9C4A33` |
| `--ok` | `#2F6B52` | `#7FAE94` | `#2F6B52` | `#2F6B52` | `#2F6B52` |
| `--on-accent` 强调底上的字 | `#F6F1E9` | `#10100E` | `#FBFCF9` | `#FFFCFB` | `#FAFAF8` |

派生 token（每主题重算，组件不直接写颜色）：

| token 组 | 说明 |
|---|---|
| `--rgb-bg / --rgb-ink / --rgb-gold / --rgb-accent / --rgb-ok / --rgb-danger / --rgb-shadow` | 供 `rgb(var(--rgb-x) / α)` 派生半透明色（hover 底色、阴影、渐变）；暗色主题的 `--rgb-shadow` 为纯黑，保证阴影方向正确 |
| `--header-bg`、`--overlay` | 由 `--rgb-bg` / `--rgb-shadow` 派生；noir 用更深的遮罩 |
| `--shadow-card / --shadow-float / --shadow-menu / --shadow-panel` | 四级阴影，层级：卡片 < 浮层 < 菜单 < 抽屉/弹窗 |
| `--selection-bg / --selection-fg` | 选区配色（noir 反转为深金底 + 浅字） |
| `--glow-gold / --glow-accent` | Hero/页头/404 的环境光晕强度；暗色主题降低强度（0.07 / 0.04），避免大片暖色雾感 |
| `--paper-grain` | 纸感颗粒强度（暗色略高） |

### 2.3 主题技术契约（与 JS 的接口）

- 状态：`<html data-theme="ivory|noir|jade|rose|graphite">`；`data-theme-choice` 记录用户选择（含 `auto`）；`data-theme-source="manual|system|url"`。
- 持久化：`localStorage["aipulse.theme"]` ∈ 5 主题 + `auto`（默认 `auto`）；URL `?theme=` 优先且不写 localStorage。
- 防闪烁：每页 `<head>` 内联脚本在 CSS 之前完成解析并写入 `data-theme`（`auto` 由内联脚本解析为 ivory/noir）。
- 无 JS 兜底：`theme.css` §7 的 `@media (prefers-color-scheme: dark)` 内对 `[data-theme="auto"]` / 无 `data-theme` 输出 noir token，其余主题固定。
- `<meta name="theme-color">` 由内联脚本按 `{ivory:#F6F1E9, noir:#0E0D0B, jade:#EEF2EC, rose:#F6EDEA, graphite:#F3F2EF}` 更新，**必须与 `--bg` 一致**。
- CSS 加载顺序固定：`theme.css → base.css → components.css → assistant.css → share.css`。
- 兼容：保留 `data-theme="dark"` / `"light"` 旧值别名（映射 noir / ivory），便于灰度过渡。

---

## 3. 字体与排版层级

- 标题衬线栈：`"Cormorant Garamond", "Noto Serif SC", "Songti SC", Georgia, serif`
- 正文无衬线栈：`"Inter", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- 全部系统字体，**无外链字体/图片**；拉丁字形缺失时回退系统字库，中文由系统衬线渲染。

| token | 值 | 用途 |
|---|---|---|
| `--fs-display` | `clamp(2.4rem, 5vw, 4.2rem)` | Hero/页头大标题 |
| `--fs-h1` | `clamp(2.2rem, 4.2vw, 3.4rem)` | 文章级标题 |
| `--fs-h2` | `clamp(1.7rem, 2.6vw, 2.3rem)` | 区块标题（衬线） |
| `--fs-h3` | `1.25rem` | 卡片标题 |
| `--fs-body` | `1rem` | 正文 |
| `--fs-sm` / `--fs-xs` | `0.875rem` / `0.75rem` | 辅助字号 |
| `--fs-label` | `0.6875rem` | 全大写小标签（配 `--ls-label: .14em`） |
| `--lh-body` / `--lh-tight` | `1.75` / `1.16` | 正文行高 / 标题行高 |
| 按钮字号 | `0.875rem`（`--sm` 为 `0.8125rem`） | 主/次级按钮统一 |

使用规则：小标签用 `uppercase + letter-spacing .14em + --gold-deep` 的金属感；`--highlight` 只替换其中的"强调语义"文字（见 §5.4）；正文不使用金色。

---

## 4. 颜色语义与命名

| 角色 | token | 约束 |
|---|---|---|
| 页面底色 | `--bg` | — |
| 卡面/浮层 | `--surface` | 卡片、菜单、抽屉基底 |
| 次级面 | `--surface-2` | 页脚、表头 hover、次级块 |
| 正文 | `--ink` | 对比度 ≥ 4.5:1（全部主题实测 ≥ 15:1） |
| 辅文 | `--muted` | 对比度 ≥ 4.5:1（实测 5.2–7.1:1） |
| 金属线 | `--line` / `--line-strong` | 1px 分割线与描边 |
| 金属色 | `--gold` / `--gold-soft` / `--gold-deep` | 仅装饰、细线、图标、金色文字（`--gold-deep` 文字 ≥ 4.5:1） |
| 主题强调 | `--highlight` | 标题高亮字、栏目标签、链接、回顶箭头、焦点环 |
| 次强调 | `--accent` | 分类标签、聊天用户气泡等小块填充 |
| 状态 | `--ok` / `--danger` | 数据源状态灯、错误文案 |

组件中禁止出现 `#hex`、`rgb(…)` 字面色值；半透明一律 `rgb(var(--rgb-*) / α)`。

---

## 5. 按钮与交互控件

### 5.1 主按钮（Primary，对应现有 `.btn--ink`，兼容 `.btn--primary`）

填充 = 金属色（ivory/noir）或主题色（jade/rose/graphite）；文字与填充对比度全部 ≥ 4.5:1。

| 主题 | 填充 | 文字 | 对比度 | hover 填充 | hover 对比度 | active 填充 | active 对比度 |
|---|---|---|---|---|---|---|---|
| ivory | `#B08A4F` | `#14100C` | 5.95 | `#A48049` | 5.20 | `#9E7C47` | 4.89 |
| noir | `#C9A227` | `#14100C` | 7.83 | `#D0A92C` | 8.47 | `#B59223` | 6.40 |
| jade | `#3F6B57` | `#FBFCF9` | 5.91 | `#355A49` | 7.53 | `#2C4C3E` | 9.23 |
| rose | `#8A5D67` | `#FFFCFB` | 5.35 | `#7A5160` | 6.48 | `#6B4553` | 7.91 |
| graphite | `#4A4844` | `#FAFAF8` | 8.73 | `#3D3B38` | 10.68 | `#33312F` | 12.40 |

- 填充上叠加 `--btn-primary-sheen`（4%–18% 白色顶光渐变）形成金属微光，不改变文字对比度。
- `:hover` 变深/微亮 + 中性低阴影；`:active` 填充再深一档 + `--btn-active-shadow` 内影 + 下移 1px；`:focus-visible` 2px `--highlight` 外环、offset 3px；`:disabled`/`[aria-disabled]` 透明度 `0.45` 且禁用指针。
- **禁止**大面积纯黑填充；暗色主题也不得使用重黑主按钮。

### 5.2 次按钮（Secondary，`.btn--ghost` / `.btn--secondary`）

| 状态 | 描边 | 背景 | 文字 |
|---|---|---|---|
| 默认 | `--line-strong` | 透明 | `--ink` |
| hover | `--gold` | `rgb(gold / 10%)` | `--highlight` |
| active | `--gold` | `rgb(gold / 10%)` + 内影 | `--highlight` |
| focus-visible | 2px `--highlight` 外环 | — | — |
| disabled | — | — | 透明度 0.45 |

### 5.3 图标按钮 / 分段控件 / 标签

- `.icon-btn`：40px 圆形（≤480px 36px，≤400px 34px），1px `--line` 描边，hover 金边 + `--icon-hover-bg`（10% 金），`[aria-pressed="true"]`/`.is-active` 金边 + 强调色图标。
- `.chip` / `.board-tab` / `.view-btn`：选中态从 v1.0 的"黑底白字"改为**主题强调色描边（`--highlight`）+ 16% 金色淡底 + 墨色文字**（图形化控件不再压暗页面）；hover 10% 金底。
- `.tag` / `.metric-chip`：1px 描边胶囊；金色标签文字用 `--gold-deep`，选中/强调标签文字用 `--highlight`。
- `.link-arrow` / `.text-link` / `.footer` 外链箭头：hover/装饰箭头取 `--highlight`。

### 5.4 `--highlight` 使用清单

用于：Hero 高亮字与下划金线、`eyebrow` 等栏目标签、`brand-cn`、`panel-no`、`stat-value small`、`model-org`、`metric-chip` 文字、导航当前项下划线、页脚栏目标题、`share-btn`/`icon-btn` hover 图标、链接 hover、回顶箭头、焦点环、主题菜单选中项文字/勾选、`theme-picker` 打开态图标。
保留 `--gold` 的地方：1px 金属线、分割装饰、金色底、滚动条渐变（noir 单独提亮）、`--gold-soft` 描边。

---

## 6. 组件规范

### 6.1 卡片
- 基底 `--surface`，1px `--line`，圆角 `--r-1`，阴影 `--shadow-card`；hover 上浮 2px、描边 `--gold-soft`、阴影升为 `--shadow-float`；动效 `--dur/--ease`。
- 留白：卡片内 `clamp(20px, 2vw, 26px)`；区块间距 `--section-y`；整体保持大留白。

### 6.2 表单与搜索
- 输入类：`--surface` 底、1px `--line`、胶囊或 `--r-2` 圆角；`:focus-visible` 主题强调色边框 + `--focus-ring`（`--highlight`）外环；placeholder 用 `--muted`（85% 不透明）。
- 复选框/滑杆：`accent-color: var(--highlight)`。

### 6.3 表格
- `.table-scroll` 横向滚动优先；窄屏表格整体横滚，不压缩内容；滚动条单独 8px、`--line-strong` thumb（低干扰），不继承全局金色滚动条。
- ≤700px 增加右侧内阴影提示（`inset -16px` 阴影），提示可横向滚动。
- 行 hover 用 `--surface-2`；表头小标签 `--muted` + 字距。

### 6.4 主题选择器（header）

Markup 契约（site-mvp 实现，CSS 只读）：

```html
<div class="theme-picker-wrap">
  <button class="icon-btn theme-picker" data-theme-picker aria-haspopup="menu" aria-expanded="false">…palette icon…</button>
  <div class="theme-menu" data-theme-menu role="menu" hidden>
    <p class="theme-menu-title">主题</p>
    <button class="theme-option" role="menuitemradio" aria-checked="false" data-theme-value="ivory">
      <span class="theme-swatch" data-theme-swatch="ivory"></span>
      <span class="theme-option-label">纸墨雅金</span>
      <span class="theme-option-check">✓</span>
    </button>
    <!-- noir / jade / rose / graphite 同构 -->
  </div>
</div>
```

- 触发按钮 40px 圆形 `.icon-btn`；打开态（`[aria-expanded="true"]` 或 `wrap.is-open`）金边 + 10% 金底 + `--highlight` 图标。
- Popover：绝对定位 `top: calc(100% + 12px); right: 0`，宽 `--menu-min-width: 248px`，`--menu-bg` 底 + 顶部 6% 金色渐变、1px `--line`、`--r-2`、`--shadow-menu`、180ms 上浮淡入。
- 标题行：11px 全大写字距 `.14em`、`--muted`、底部 1px 分隔线。
- 选项：`grid 22px / 1fr / 14px`，9×10px 内边距，`--r-2`；hover 10% 金底；选中 `aria-checked="true"`（或 `.is-active`）= 16% 金底 + `--highlight` 文字 + 勾选显形 + 色板环。
- 色板点 `.theme-swatch`：22px 圆，`data-theme-swatch="<id>"` 显示三色斜分渐变（底/金/强调）；`auto` 显示左浅右深双色。
- 键盘：Enter/Space/↓ 打开、↑↓ 移动、Esc 关闭、Tab 循环；焦点环 2px `--highlight`。`auto` 选项与 5 个固定主题之间以 1px 分隔线分组。
- ≤560px：Popover 变为 header 下的**全宽下拉**（`position: fixed; top: calc(--header-h + 8px); left/right: --gutter`），限高可滚动；不引入第三方库。

### 6.5 语言切换（`.lang-toggle`）
- 胶囊文字按钮（覆盖 `.icon-btn` 的固定圆形尺寸为 `width:auto`），内容「中 / EN」，11px 字距 `.08em`；默认 `--muted`，当前语言 `--ink` + 600 字重（由 `.lang-code.is-active` 或 `html[data-lang]` + `data-lang-code` 驱动，两套钩子都支持）。
- hover：金边 + 10% 金底；键盘 focus-visible 同全站焦点环。
- 与主题、导航按钮在 header 同排；≤560px 收窄 padding，≤400px 再收窄，360px 不换行。

### 6.6 回顶按钮（`.to-top`）
- `app.js` 动态创建 `<button class="to-top" data-to-top>`；滚动 > 600px 加 `.is-visible`（同时兼容 `[data-visible="true"]`）。
- 44px 圆形（≤560px 42px），1px `--gold-soft` 细环 + `--surface` 底 + `--highlight` 箭头 + `--shadow-card`；hover 金边、`--shadow-float` + 4px 金色光晕、上移 3px；active 内影；focus-visible 焦点环。
- 位置：`right: 26px`、`bottom: 96px`（≤560px：`16px` / `84px`），并叠加 `env(safe-area-inset-*)`；z-index 60 < header 80 < AI 助手 90，**与 AI 助手入口上下错位、永不重叠**。
- 隐藏时 `opacity:0; visibility:hidden; translateY(10px); pointer-events:none`，240ms 过渡；`prefers-reduced-motion` 关闭过渡；滚动行为由 JS 按 reduced-motion 选择 smooth/auto。

### 6.7 滚动条
- 全局 WebKit：`width/height: 10px`，track 透明，thumb 圆角胶囊 + 2px 透明边（视觉 6px），渐变 `--gold-soft → --gold`，hover 渐变 `--gold → --gold-deep`，无箭头按钮。
- 全局 Firefox：`scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb-color) transparent`（继承到所有滚动容器）。
- 暗色提亮：noir（以及 auto 解析到 noir）把 thumb 改为 `--gold → --gold-deep`（亮金），Firefox 颜色用 `--gold`，在近黑底上对比度 ≥ 8:1，避免"看不见"。
- 表格内部横向滚动条：`.table-scroll` 单独 8px + `--line-strong` thumb，保持可用且不抢视觉；`.board-tabs` 横滚 6px 细条；AI 助手消息区 6px `--line-strong`。
- `html { scrollbar-gutter: stable }` 避免长短页切换时的横向跳动。

### 6.8 AI 助手与分享组件
- 全部改为引用全局 token（移除 v1.0 的硬编码回退色与 `prefers-color-scheme` 颜色块）。
- 发送按钮 / 设置保存按钮 / 分享卡"下载"主按钮统一使用主按钮 token（noir 金、jade 墨绿、rose 豆沙、graphite 石墨），4 态齐全。
- 用户气泡用 `--accent` 底 + `--on-accent` 文字；消息内链接、快捷问题、设置区标题文字用 `--highlight`（≥ 4.5:1）。
- 分享菜单/弹窗阴影改用 `--shadow-menu` / `--shadow-panel`，遮罩用 `--overlay`。
- 助手悬浮入口底部叠加 `env(safe-area-inset-bottom)`；与回顶按钮间距在桌面 28px、移动端 26px。

---

## 7. 动效

| 场景 | 时长/曲线 | 说明 |
|---|---|---|
| hover / 颜色过渡 | `--dur`（300ms）/ `--ease` | 统一缓动 `cubic-bezier(.22,.61,.36,1)` |
| 主题菜单出现 | 180ms | 透明度 + translateY(-6px) |
| 回顶出现/隐藏 | 240ms | 透明度 + translateY(10px) |
| 卡片 hover | 300ms | 上浮 2px + 阴影升级 |
| 滚动淡入 `.reveal` | 600ms | IntersectionObserver 加 `.is-in` |
| `prefers-reduced-motion` | — | `--dur: .01ms`；菜单/回顶动画关闭；平滑滚动改 `auto` |

---

## 8. 响应式断点与移动端

| 断点 | 行为 |
|---|---|
| ≥1440 | 容器 1180px 居中，大留白 |
| ≤1024 | 模型库/资源 2 列；关于页 facts 3 列 |
| ≤960 | 导航折叠为全屏下拉；hero 单列；页脚 2 列 |
| ≤700 | 区块头纵向、表格最小宽 680px（横滚）、页脚收口 |
| ≤640 | 助手抽屉全屏；卡片单列（部分 2 列） |
| ≤560 | 主题菜单变全宽下拉；回顶按钮 42px / 右下 16+84px；header 操作组 gap 6px |
| ≤400 | 品牌标识 28px、icon 按钮 34px、语言胶囊 padding 7px（360px 一屏容纳品牌 + 主题 + 语言 + 菜单） |
| ≤480 | 首页标题/卡片字号降档，hero 面板内边距压到 18px |

移动端原则：无横向溢出（`body{overflow-x:hidden}` + 所有 grid/flex 子项 `min-width:0`）；触控目标 ≥34px，主按钮高度 ≥44px；`env(safe-area-inset-*)` 处理刘海/手势区。

---

## 9. 可访问性（a11y）

1. **对比度**：正文/辅文/标签/按钮 4 态均 ≥ 4.5:1（见 §11 实测）；金色仅装饰时允许更低，但任何金色**文字**都用 `--gold-deep` 或 `--highlight` 的可读版本。
2. **焦点**：全站 `:focus-visible` 统一 2px `--highlight` 外环 + 3px offset；菜单项用内缩焦点环避免溢出裁切；不依赖颜色单独传达状态（配套文字/勾选/aria）。
3. **键盘**：主题菜单支持 Enter/Space/↑↓/Esc/Tab；语言按钮可聚焦；回顶按钮为原生 `<button>` 可 Tab 到达。
4. **ARIA**：`.theme-picker` `aria-haspopup="menu"`/`aria-expanded`；`.theme-menu` `role="menu"`；`.theme-option` `role="menuitemradio"` + `aria-checked`；`.lang-toggle` 有 `aria-label`；`.to-top` 有 `aria-label`/`title`（i18n key `ui.toTop`）。
5. **动效偏好**：`prefers-reduced-motion: reduce` 全量降级。
6. **降级**：`@supports not (backdrop-filter)` 时 header/filter-bar 改不透明 `--bg`；`rgb(var(--rgb-x) / α)` 不支持的老浏览器退化为透明/中性色但不影响文字对比度。
7. **禁用态**：透明度 0.45 低于 4.5:1，属 WCAG 1.4.3 对"非活动控件"的豁免，且同时设置 `cursor:not-allowed`。

---

## 10. 视觉验收截图清单（Lead 用 CDP/headless Edge）

1. `theme-{ivory,noir,jade,rose,graphite}-home.jpg`：**Hero 高亮字/栏目标签/链接颜色随主题变化**（金/亮金/青瓷绿/豆沙玫瑰/石墨灰），jade/rose 背景色明显区别于 ivory。
2. 主按钮 4 态：默认/hover/active/focus-visible/disabled（5 主题各一张或拼接图）。
3. `theme-picker-open.jpg`：标题分隔线、6 个色板点（含 auto 双色）、选中项高亮 + 勾选、键盘焦点环。
4. `theme-totop-scrolled.jpg`：滚动 > 600px 后回顶按钮出现在 AI 助手正上方，间距合理、不重叠；hover 态。
5. 滚动条：长页面右侧 10px 金渐变 thumb（noir 更亮）；模型库/排行页表格内部 8px 细条独立可用；Firefox 侧 `scrollbar-color`（如可测）。
6. 移动端 360/390：header 品牌 + 主题 + 中/EN + 菜单同排不溢出；主题菜单全宽下拉；回顶按钮与助手不重叠。
7. 刷新首页无 FOUC（首帧即目标主题，无白/黑闪）。
8. `?theme=jade&lang=en` 深链：主题 + 英文同时生效，`data-theme-choice="jade"`。

---

## 11. 对比度自检结果（WCAG 2.x，实测）

> 方法：从 `theme.css` 解析每套主题解析后的 token，按 WCAG 相对亮度公式计算（脚本化、非目测）。目标：文字类 ≥ 4.5:1。

| 主题 | 最差文字对比度 | 结论 |
|---|---|---|
| ivory | 4.75:1（`--gold-deep` 小标签 on bg） | PASS |
| noir | 4.92:1（`--on-accent` on `--accent`） | PASS |
| jade | 4.93:1（`--gold-deep` 小标签 on bg） | PASS |
| rose | 4.65:1（`--gold-deep` 小标签 on bg） | PASS |
| graphite | 4.81:1（`--muted` on `--surface-2`） | PASS |

关键组合（各主题均满足）：

| 组合 | ivory | noir | jade | rose | graphite |
|---|---|---|---|---|---|
| 正文 on bg | 16.84 | 16.53 | 14.61 | 15.55 | 16.01 |
| 正文 on surface | 18.64 | 15.61 | 16.06 | 17.55 | 17.15 |
| 辅文 on bg | 5.32 | 7.12 | 5.27 | 5.24 | 5.22 |
| 辅文 on surface-2 | 5.00 | 6.40 | 4.93 | 4.78 | 4.81 |
| `--highlight` 文字 on bg | 4.75 | 9.47 | 5.37 | 4.74 | 6.86 |
| 主按钮文字/填充 | 5.95 | 7.83 | 5.91 | 5.35 | 8.73 |
| 主按钮 hover | 5.20 | 8.47 | 7.53 | 6.48 | 10.68 |
| 主按钮 active | 4.89 | 6.40 | 9.23 | 7.91 | 12.40 |
| 次按钮文字 on bg | 16.84 | 16.53 | 14.61 | 15.55 | 16.01 |
| 状态 ok / danger on bg | 5.58 / 5.43 | 7.76 / 7.00 | 5.54 / 5.73 | 5.45 / 5.30 | 5.61 / 5.45 |

装饰性金色（`--gold` on bg）约 2.8–3.1:1（noir 8.0:1），仅用于细线与图标，不承载文字信息。

---

## 12. 体积与性能

v1.3 起 CSS 按页拆分（详见 §21），不再把全部组件打进同一个文件：

| 页面/组合 | raw（≤120 KB） | gzip（≤26 KB） |
|---|---|---|
| 一般页（news/rankings/resources/projects/about/404）：theme+base+components+assistant+share | **105.1 KB** | 20.6 KB |
| 首页 index：上述 + `dashboard.css`（约 13.3 KB） | **118.4 KB** | 23.6 KB |
| 技能页 skills：上述 + `skills.css` | **111.3 KB** | 22.4 KB |
| 模型库 models：上述 + `compare.css`（约 6.9 KB） | **112.0 KB** | 22.5 KB |

- 拆分文件：`dashboard.css`（图表/KPI，仅 index）、`skills.css`（技能页 toolbar/modal/提交/代码块，仅 skills）；`components.css` 保留通用组件与共享技能卡样式（projects 页也用）。
- v1.3 新增图表/斩杀线/热榜/对齐样式约 **12.3 KB raw**（dashboard.css），skills 页专属样式拆为 6.5 KB；全站各页均在预算内（index 余量 ~0.6 KB，后续新增 UI 应继续按页拆分而不是回填 components）。
- 无新增外链资源/字体/图片；纸感颗粒为内联 SVG data URI，logo 为既有 SVG；二维码为 Lead 预生成的本地 PNG（`assets/img/qr-*.png`），无外链生成 API。
- 主题切换只改 `html[data-theme]`，CSS 已全部加载 → 切换瞬时、无网络请求、无 FOUC。
- 阴影/半透明色全部由 token 派生，未引入图片或滤镜资源（graphite 的 logo 灰度仅为 CSS filter）。
- 清理：移除 v1.0 遗留 `.theme-toggle/.icon-*`、`.subscribe-inner` 与硬编码颜色的 select 箭头 data URI（改为 `currentColor` 细线箭头，暗色主题可读）。

---

## 13. 已知限制

1. 品牌 logo 为固定香槟金 SVG（`assets/img/logo.svg`）：ivory/noir/jade/rose 保持品牌金；graphite 下用 `filter: grayscale(1) contrast(1.06)` 变为银灰以贴合主题。若后续希望 logo 完全随主题，可改为内联 SVG + `currentColor`（需 site-mvp 改 HTML，非本次范围）。
2. `og-cover.png` 等社交分享图为既有静态图，不随主题变化（社交平台展示场景，成本/收益不划算）。
3. `auto` 的无 JS 兜底只在 ivory/noir 间切换；手动主题选择依赖 JS。
4. 禁用态按钮对比度低于 4.5:1（WCAG 对非活动控件豁免），已同时提供指针与视觉提示。
5. 字体为系统栈：未安装 Cormorant Garamond / Inter 的环境由 Georgia / 系统中文字体回退，字形与国际版设计稿略有差异但无外部请求。

---

## 14. v1.0 → v1.1 CSS 变更清单

| 文件 | 变更 |
|---|---|
| `theme.css` | 重构为「共享原语 + 5 主题调色板 + auto 兜底」三层；新增 `--highlight`、按钮 tokens（primary/secondary 4 态）、菜单/回顶/滚动条 tokens、`--rgb-*` 派生色、四级阴影、色板预览渐变；旧 `dark/light` 别名保留 |
| `base.css` | 选区改用 `--selection-bg/fg`；`scrollbar-gutter: stable`；`-webkit-tap-highlight-color` 透明；eyebrow 等标签改用 `--highlight` |
| `components.css` | 按钮 4 态重做（去纯黑）；chip/tab/view-btn 选中态改为金色淡底；新增主题选择器、语言切换、回顶按钮、滚动条美化、窄屏 header 收口、`@supports` 降级、表格横滚提示；hero/页头/404 渐变与状态灯改为 `rgb(var(--rgb-*))`；卡片/导航/页脚强调色改用 `--highlight` |
| `assistant.css` | 移除硬编码回退色与 `prefers-color-scheme` 颜色块，全部改 token；发送/保存按钮改主按钮样式；安全区适配；文字性金色改 `--highlight` |
| `share.css` | 同上 token 化；分享主按钮改主按钮 token；遮罩/阴影用全局 token |

---

## 15. v1.2 首页数据仪表盘（`#overview-dashboard`）

风格：克制的「数据杂志」——纸面卡片 + 1px 细线分隔 + 衬线大数字 + uppercase 小标签 + 低饱和主题色数据墨水；不要霓虹/发光/高饱和。全部颜色来自 token，5 主题自动适配（ivory/noir 金、jade 青瓷绿、rose 豆沙、graphite 石墨）。

### 15.1 新增 token（`theme.css`）
| token | 用途 |
|---|---|
| `--rgb-highlight` | 主题强调色的 RGB 通道，供数据墨水 `rgb(var(--rgb-highlight)/α)` 派生（ivory 135 101 47 / noir 211 177 100 / jade 63 107 87 / rose 138 93 103 / graphite 85 83 78） |
| `--dash-track` | 横条轨道底色（`rgb(ink / 6%)`，暗色自动反相） |
| `--code-bg` | 安装命令代码块底（ink 4.5% 淡底） |
| `--qr-surface` | 二维码静区底色（`#ffffff`，扫码可读性要求，主题无关） |

### 15.2 DOM/class 契约（Markup 由 site-mvp 实现）
`section#overview-dashboard.dashboard > .container`；section-head 复用 `.section-head`（eyebrow + h2 + `.section-head__aside` 更新时间）。
- KPI：`.dash-kpis > .dash-kpi > .dash-kpi-label + .dash-kpi-value + .dash-kpi-note`；数值 count-up 由 JS 写 textContent。
- 卡片：`.dash-grid > .dash-card(.dash-card--trend | .dash-card--price)`，头 `.dash-card-head`（h3 + `.dash-card-head-note`），身 `.dash-card-body`，脚 `.dash-card-note`；价格卡跨满整行，优先 `.dash-card--price`，缺失时以 `.dash-grid > .dash-card:last-child` 兜底。
- 趋势：`.dash-spark-wrap > svg.dash-spark`（viewBox 560×200，`preserveAspectRatio="none"`）；内层 `.dash-spark-grid`（line 元素）/ `.dash-spark-area`（渐变面积，`<defs><stop>` 由 CSS 染成 `--highlight`）/ `.dash-spark-line` / `.dash-spark-dot[tabindex]`；tooltip `.dash-tooltip`（位于 `.container` 内，`hidden` ⇄ `.is-visible`，JS 用 left/top 相对 section 定位；CSS 只做 translateY 上浮，不能再 translateX）。
- 横向条：`.dash-bars/.dash-price > *-row > *-label + *-track > *-fill + *-value`；JS 写内联 `style="--bar:0.62"`（0–1），CSS 用 `calc(var(--bar)*100%)`。

### 15.3 视觉规格
| 元素 | 规格 |
|---|---|
| KPI 数字墙 | 6 列 hairline 网格（容器 border-top/left + 单元 border-right/bottom，无双重线）；标签 11px uppercase `--highlight`；数字衬线 `clamp(1.55rem,2.2vw,2.1rem)` + `nowrap`、tabular-nums；`.dash-kpi-value` 为 baseline flex 容器（`gap:.18em` 保证数字与单位间隙），数值包 `.dash-kpi-number`、单位 `.dash-kpi-unit`（`.42em`、`--muted`、nowrap）；`[data-kpi="capacity"] .dash-kpi-number` 降一档到 `clamp(1.3rem,1.8vw,1.7rem)`，保证「264.4M + tokens」单行、六格等高；说明 12px `--muted`；hover 底 `--surface-2` |
| 卡片 | `--surface` 底 + 1px `--line` + `--r-1` + `--shadow-card`；头部分隔线；桌面 3 列，趋势卡跨 2 列、价格卡跨 3 列 |
| Sparkline | 面积渐变（`<stop>` 用 `--highlight`，22%→0）；线 `--highlight` 1.6px 圆头 + `vector-effect:non-scaling-stroke`；端点 `--surface` 填充 + 强调色描边；x 轴 10px `--muted`（≤640px 提升到 18 用户单位、端点 r=4.5，缩放后仍可读）；网格线 `--line` |
| 横向条 | 轨道 6px `--dash-track`；填充 `linear-gradient(90deg, rgb(--rgb-highlight/55%), --highlight)`；标签 ink、数值 tabular-nums；hover 标签变 `--highlight` |
| Tooltip | 纸面卡：`--surface` + 1px line + `--r-2` + `--shadow-menu`；140ms 淡入上浮；`is-visible` |
| 空数据 | 数字显示「—」、条宽 0（JS 兜底），样式不塌陷 |

### 15.4 入场动效（一次性，≤1.2s，无弹跳）
JS 在 section 进入视口时给 `.dashboard` 加一次 `.is-in`；**未加 `.is-in` 时所有内容默认可见**（无 JS / IO 失败也安全）。
| 动画 | 时长 | 曲线 | 说明 |
|---|---|---|---|
| KPI / 卡片 `dash-rise` | 480ms | `--ease` | 透明度 + translateY(10px)→0 |
| 横条 `dash-grow` | 900ms | `--ease` | width 0 → `--bar` 占比 |
| 趋势图 `dash-reveal` | 1000ms | `--ease` | `clip-path` 左→右揭示（不依赖 pathLength） |
| `prefers-reduced-motion` | — | — | 全部 `animation:none`，直接渲染终值 |

### 15.5 响应式
| 断点 | 行为 |
|---|---|
| ≤1100 | KPI 3 列、卡片 2 列（趋势保持跨 2） |
| ≤760 | 卡片单列，趋势/价格取消跨列 |
| ≤640 | KPI 2 列；数字 1.9rem；条标签列收窄，无横向溢出 |

---

## 16. v1.2 技能页 / 使用引导 modal / 提交区

### 16.1 页面骨架
`skills.html`（`body[data-page="skills"]`）：`.page-masthead`（复用）→ `.skills-toolbar`（sticky，已并入 `.filter-bar` 公共样式）→ `.skills-grid` → `.empty-state`（复用）。工具栏内：`.filter-row`（强制 `flex-wrap`，中英文均不出容器）、两组 `.chips.skills-filters`（桌面 hairline 分隔、移动端合并）、`.search-field`（`flex:1 1 220px`/`max-width:340px`）、`.result-count`（右对齐固定）。EN 模式下 `html[lang="en"] .eyebrow-en{display:none}` 去掉与本地化标签重复的英文后缀。

### 16.2 技能卡（`.skill-card`）
基础样式并入 `.model-card`（surface/1px line/`--r-1`/shadow/hover 上浮）→ 技能卡只需语义差异：
| 区域 | class | 规格 |
|---|---|---|
| 顶部 | `.skill-card-top` | 11px uppercase muted，flex wrap |
| 来源徽标 | `.skill-badge` + `--mine` / `--official` / `--community` | 胶囊 1px 描边 + 菱形点：mine=`--highlight` 描边/8% 底/强调字；official=`--gold-soft` 描边/`--gold-deep` 字；community=中性 `--line-strong`/`--muted` |
| 名称 | `.skill-name` | 衬线 1.25rem/600，最多 2 行 |
| 描述 | `.skill-desc` | 13px muted，3 行截断（移动端 2 行） |
| 标签 | `.skill-tags > .tag` | 复用 tag |
| 元信息 | `.skill-meta` | 11px muted，作者/license/更新，上边 1px 分隔 |
| 操作 | `.skill-actions` | 「使用引导」`.btn.btn--ghost.btn--sm` + `.share-btn`（靠右） |
| 精选 | `.skill-card.is-featured` | 描边 `--gold-soft` |
| 紧凑变体 | `.skills-grid--compact` | 项目页 4 列（≤1024 2 列、≤700 1 列），卡片 padding 收紧 |

### 16.3 使用引导 modal（`.skill-modal`）
- 结构：`.skill-modal[hidden] > .skill-modal-backdrop + .skill-modal-panel`，面板内 `.skill-modal-head`（`#skill-modal-badge` + h2 + `.icon-btn` 关闭）、`.skill-modal-body`、`.skill-modal-cols > .skill-modal-block`（适合/不适合，标题为 `h3`）、`.skill-install`（inline code + 复制按钮）、`.skill-targets`（安装目录行 + 按钮）、`.skill-steps`（衬线数字步骤）、`.code-block`（自检/文件结构）、`.skill-modal-foot`（源码 + 分享，按钮靠右）。
- 桌面：居中 `min(720px,100%)`，max-height 86vh 内滚动，`--r-3` + `--shadow-panel`，240ms 淡入上浮；遮罩 `--overlay` + 3px blur。
- 移动端 ≤640px：**底部 sheet**（align-items:flex-end，全宽，顶部圆角，底部 safe-area padding）。
- 焦点：全站 `:focus-visible` 2px `--highlight` 环；`aria-modal`/focus trap/Esc 由 JS 负责。

### 16.4 提交区与代码块
- `.submit-grid` 三路径卡（Issue / JSON 模板 / Fork&PR）：桌面 3 列 → ≤1024 2 列 → ≤700 单列；卡内 h3/p + 按钮贴底。
- `.submit-form`：提交卡内联表单（`display:grid`，label 小字、input 1px line + `--r-2`），用于 JSON 模板下载路径。
- `.submit-criteria`：审核标准区（上边 1px 分隔、菱形金点列表，≤82ch）。
- `.submit-note` 审核说明（≤82ch muted）。
- `.code-block`：等宽 12px、ink 4.5% 淡底、1px line、`--r-2`、横向滚动、`white-space:pre`；复制按钮 `.code-copy` 胶囊（焦点环 + hover 金边），放在 `pre` 内时绝对定位右上。
- 安装目标可写 `~/.dsh/skills/` / `~/.claude/skills/` / 通用目录，由内容侧提供，样式不限。

---

## 17. v1.2 分享卡地址区与分发入口

### 17.1 预览弹窗地址区（DOM 由 ai-share 的 share.js 渲染）
```html
<div class="share-card-address">
  <p class="share-card-address-row"><span class="share-card-address-label">站点地址</span>
    <a class="share-card-url" href="…">chengxi-z.github.io/llm-pulse</a></p>
  <!-- GitHub / RSS 同构 -->
</div>
```
样式：上边 1px `--line` 分隔、6px 行距；标签 10px uppercase `--muted`、`min-width:64px`；URL 用 `--highlight` + 下划线（`text-decoration-color: rgb(--rgb-highlight/40%)`）、`overflow-wrap:anywhere` 不裁切；对比度 ≥4.5:1（实测 4.7–9.5:1）。快捷链接复用 `.share-card-url`。
Canvas 内的地址区由 ai-share 绘制（背景 ≥4.5:1、字号 ≥22px），CSS 不参与。

### 17.2 站内分发入口
- 订阅区 `.subscribe-address > p`：站点/GitHub/RSS 三行居中，链接 `--highlight`，复制按钮用小号 `.btn`；其后 `.feed-note` 变纸面小卡（1px line + 左侧 2px 金线）。
- 关于页 `.about-qr`：两列卡（`figure`：120px 二维码 + `figcaption` 说明），二维码白底 `--qr-surface` + 6px 静区 + `image-rendering:pixelated`；≤640px 单列、图 96px。
- 榜单「分享本榜」：复用 `.share-btn`，置于 `.rank-panel-meta` 内，`margin-left:auto` 右对齐（30×30）。

---

## 18. v1.2 动效与移动端补充

### 18.1 动效参数
| 场景 | 时长/曲线 |
|---|---|
| Dashboard 入场（rise / grow / reveal） | 480 / 900 / 1000ms，`--ease`，一次，无弹跳 |
| Skill modal 出现 | 240ms 淡入 + translateY(14px) |
| Dashboard tooltip | 140ms 淡入上浮 |
| 卡片/按钮/链接 hover | `--dur` 300ms `--ease`（沿用 v1.1） |
| `prefers-reduced-motion` | Dashboard 全部动画、modal 动画、tooltip 过渡关闭；数字/条/图直接终值 |

### 18.2 移动端
- Dashboard：KPI 2 列（≤640）、卡片单列（≤760）、趋势 SVG 自适应宽度、tooltip 点按显示（JS）。
- 技能页：工具栏换行、筛选两组合并、卡片单列（≤700）、modal 底部 sheet（≤640）。
- 分享卡预览地址区自动换行；订阅地址行居中换行；关于二维码单列。
- 360/390 检查点：header 三入口同排（v1.1 延续）、无横向溢出、modal 底部按钮不被安全区遮挡、KPI 数字不换行溢出。

---

## 19. v1.2 可访问性补充

1. **数据图表**：数值同时以文本呈现（KPI 数字、条数值/百分比、x 轴标签），颜色不是唯一编码；趋势图 `role="img"` + `aria-label` 由 JS 提供，并可提供表格替代（由 site-mvp 决定）；tooltip 可聚焦/点按触发。
2. **技能卡**：来源徽标有文字（我的/官方/社区），非仅颜色；卡片链接/按钮原生可聚焦；modal `aria-modal` + focus trap + Esc + 焦点归还由 JS 保证，CSS 提供可见焦点环。
3. **复制/安装**：`.code-copy` 有 `:focus-visible` 焦点环；命令块可横向滚动，不隐藏 clipped 文本；复制反馈由 JS `aria-live` 播报。
4. **对比度**：新增文字组合实测均 ≥4.5:1（muted on surface 5.2–5.9；`--highlight` URL on surface 4.74–9.47；badge 文字同色系）。二维码白底保证扫码对比。
5. **触控目标**：`.share-btn` 32px、`.icon-btn` ≥34px、modal 关闭 40px；主按钮高度 ≥44px。

---

## 20. v1.2 体积、验收与变更

### 20.1 CSS 体积（实测）
| 区块 | raw | 说明 |
|---|---|---|
| Dashboard（§22） | 5.2 KB | 契约 §5.2 预算 ≤8 KB ✅ |
| Skills 页 + modal + 提交（§23） | 7.0 KB | 含 toolbar/grid/card/badge/modal/submit/code |
| 分享卡地址区（§24） | 0.6 KB | 预览弹窗 DOM 样式 |
| 支撑块（§25） | 1.7 KB | 订阅地址/关于二维码/榜单分享/reduced-motion |
| **v1.2 新增合计** | **14.6 KB** | — |
| **全站 CSS** | **119.7 KB raw / 23.5 KB gzip** | 预算 120 KB / 25 KB ✅（raw 余量 0.3 KB；如需继续加 UI，建议先把 skills 页样式拆为独立文件按页加载） |

同时清理 v1.0 遗留：`.theme-toggle/.icon-*`、`.subscribe-inner`、select 箭头硬编码 data URI（改 `currentColor` 细线箭头）。

### 20.2 截图验收点（Lead CDP）
1. 首页 `#overview-dashboard` 5 主题（ivory/noir/jade/rose/graphite）：KPI 数字墙、12 周柱状图、价格环形饼图、AI 斩杀线、AI 话题热榜（v1.3 新版）；数字与 `data/*.json` 一致。
2. 动效：进入视口后 1.2s 内完成（可截中间态），无弹跳/闪烁；`prefers-reduced-motion` 下直接终值。
3. 首页移动端 390：KPI 2 列、卡片单列、图表不溢出、tooltip 点按。
4. `skills.html` 桌面/移动：hero、筛选、卡片网格（badge 三态）、空态、提交区三路径、安装代码块。
5. 技能「使用引导」modal：桌面居中 / 移动底部 sheet；遮罩、焦点环、复制按钮、步骤列表。
6. 分享卡预览：地址区（站点/GitHub/RSS）高对比、不裁切；分享菜单新增项。
7. 订阅区地址行、关于页二维码（白底/静区）、项目页 `.skills-grid--compact`。
8. 5 主题下 dashboard/skills 无违和、对比度达标、无 console error。

### 20.3 v1.1 → v1.2 CSS 变更清单
| 文件 | 变更 |
|---|---|
| `theme.css` | 新增 `--rgb-highlight`（5 主题 RGB）、`--dash-track`、`--code-bg`、`--qr-surface`；其余 token 不变 |
| `components.css` | 新增 §22 dashboard / §23 skills 页+modal+提交 / §24 分享卡地址区 / §25 支撑块（订阅地址、关于二维码、榜单分享按钮、reduced-motion）；`.filter-bar`/`.filter-row`/`.model-card`/`.model-name`/`.model-desc`/`.model-tags` 选择器列表并入 skills 对应 class 以复用基础样式（减小增量）；select 箭头改 `currentColor` 细线、清理 v1.0 遗留规则 |
| `assistant.css` / `share.css` | 无 CSS 变更（分享卡 canvas 由 ai-share 绘制；地址区样式在 components.css） |

---

## 21. v1.3 CSS 拆分与每页预算

| 文件 | 归属 | 内容 |
|---|---|---|
| `theme.css` | 全站 | 设计 token（5 主题）+ v1.3 donut 调色板 `--donut-1..5`（全部由 `--highlight/--gold/--line-strong` 派生） |
| `base.css` | 全站 | 重置/排版/布局基础 |
| `components.css` | 全站 | 通用组件（页头/页脚/按钮/卡片/表格/筛选/技能卡共享样式/分享地址/订阅地址/关于二维码等）；v1.2 的 dashboard 与 skills 页专属段已移出（≈68.5 KB） |
| `dashboard.css` | **仅 index** | KPI 墙、12 列卡片网格、柱状图、环形饼图、斩杀线、话题热榜、tooltip、入场动效、响应式（≈12.0 KB） |
| `skills.css` | **仅 skills** | 技能页 sticky 筛选条、使用引导 modal、提交区三路径、代码块与复制按钮、响应式（≈6.5 KB） |
| `assistant.css` / `share.css` | 全站 | AI 助手 / 分享菜单与分享卡 |

- `<link>` 顺序：`theme → base → components → dashboard.css（仅 index）/ skills.css（仅 skills）→ assistant → share`。HTML 由 site-mvp 维护。
- 每页 raw ≤120 KB、gzip ≤26 KB（实测 §12）；新 UI 若继续增长，优先继续按页拆文件，不回填 components。
- 共享规则边界：`.skill-card` 基础外观、`.skills-grid`、`.skills-grid--compact`、`.skill-badge` 等放在 components.css，因为 `projects.html` 的 Skills 区块复用且不加载 skills.css；skills 页专属 chrome 才进 skills.css。

---

## 22. v1.3 首页图表重设计

### 22.1 栅格（桌面 12 栏 → 移动单列）
| 行 | 内容 | class / 跨度 |
|---|---|---|
| R1 | 6 KPI 卡 | `.dash-kpis`（6 × 2 栏，hairline 网格） |
| R2-left | 近 12 周模型发布（柱状图） | `.dash-card--releases` 7 栏 |
| R2-right | 输出价格分层（环形饼图） | `.dash-card--price-pie` 5 栏 |
| R3-left | AI 模型斩杀线 | `.dash-card--killline` 7 栏 |
| R3-right | AI 话题热榜 | `.dash-card--hot` 5 栏 |

≤1024px 全部 `grid-column:span 12` 单列；卡片 `height:100%`、`align-items:stretch`，同排等高、header 与右侧说明同基线。

### 22.2 柱状图（`.dash-barchart`）
- SVG（viewBox 640×260，`width:100%;height:auto`）：`.dash-grid-line` 3 条 1px 虚线网格、`.dash-axis-label` 轴文字（11px `--muted`）、12 × `rect.dash-bar`、`.dash-mean-line` 金色虚线 + `.dash-mean-label`。
- 柱体：`fill: rgb(var(--rgb-highlight)/.78)`，hover/focus 变 `--highlight`（键盘 focus 用白色描边）；无弹跳。
- 入场：`.dashboard.is-in .dash-bar` 执行 `scaleY(0→1)` 700ms `--ease`，`animation-delay: calc(var(--i) * 35ms)`（stagger ≤40ms）。
- 均值线：`--gold` 虚线 + `--gold-deep` 标签（`周均 N 个`），由 JS 计算位置。
- 窄屏 ≤640：x 轴隔一显示（`text:nth-child(even){display:none}`），柱宽自适应；tooltip 复用 `.dash-tooltip`。
- 层次：柱用主题强调色，网格线 `--line`，遵守「低饱和、纸面数据杂志」原则。

### 22.3 环形饼图（`.dash-donut`）
- 5 档颜色（全部 token 派生）：`--donut-1: --highlight`、`--donut-2: rgb(--rgb-highlight/.72)`、`--donut-3: --gold`、`--donut-4: rgb(--rgb-highlight/.45)`、`--donut-5: --line-strong`；通过 `.dash-donut [data-tier="…"]` 映射，5 主题自动适配。
- 布局：`.dash-donut-wrap` 两列（环 224px + 图例），≤760px 单列；`.dash-donut-box` 相对定位包裹 SVG 与中心统计 `.dash-donut-center`（衬线大数字 + 小字）。
- 图例：`.dash-legend-row` 四列（色点 8px / 档位 / 数量 / 占比 46px 右对齐），行 hover/`.is-active` 变 `--surface-2`；色点用 `currentColor`，行 `[data-tier]` 提供颜色，文字仍为 ink/muted 保证可读。
- 交互：hover/键盘聚焦扇区时 JS 给扇区与图例行加 `.is-active`；扇区 hover 透明度 86% + 轻微提亮，不放大不弹跳。
- 入场：`.dashboard.is-in .dash-donut` scale(.94)→1 + 淡入 780ms；`prefers-reduced-motion` 关闭。

### 22.4 AI 模型斩杀线（`.dash-kill`）
- 规则：输出价 `P50` 为斩杀线（动态计算，不硬编码），轴为 log 刻度（`$0.01/$1/$10/$100`，JS 给 `--x:0..1`），免费价单列左端计入生存区；说明文案必须写明「非质量/推荐评价」。
- 结构：`.dash-kill-caption`（绘图区上方的金色标签 pill：`斩杀线 $2.00/1M`，右对齐、纸底、不遮数据）→ `.dash-kill-plot`（高 100px、`overflow:hidden`）→ `.dash-kill-bars`（绝对定位容器，底边 1px `--line` 基线）内每模型一根 3px 宽 `.dash-kill-bar`，`left: calc(var(--x) * 100%)`；`.dash-kill-axis` + `.dash-kill-tick`（10px 标签 + 7px 竖刻度，4 个 log 刻度 `$0.01/$1/$10/$100`）；`.dash-kill-line` 金色竖虚线，并用 `::before`（生存区 `rgb(--rgb-highlight/6%)`）/`::after`（斩杀区 `rgb(--rgb-gold/5%)`）给左右区域加浅底色（由 CSS 完成，无需 JS）。
- 颜色：生存 `.is-alive` = `--highlight`（80% 不透明）；斩杀 `.is-dead` = `--muted`（42% 不透明）；hover/focus 单条变 `--gold` 提高辨识。
- 计数：`.dash-kill-stats`（兼容 `#dash-kill-stats`）muted 12px + flex 换行，`.is-alive`/`.is-dead` 分别用 highlight/muted 数字；规则/口径/免责三行 `.dash-kill-rule/.dash-kill-note/.dash-kill-disclaimer` 统一小号 muted（免责 11px、80% 不透明）。
- 移动端 ≤640：plot 高 88px、标签缩到 9px、始终单行不溢出；tooltip 由 `.dash-tooltip` 点按显示。
- 入场：`.dashboard.is-in .dash-kill-bar` 800ms 自下而上伸展；reduced-motion 直接终值。

### 22.5 AI 话题热榜（`.dash-hot`）
- 结构：`ol.dash-hot > a.dash-hot-row`，行内 `.dash-hot-rank`（衬线金色 01/02）、`.dash-hot-name`、`.dash-hot-track > .dash-hot-fill(--bar)`、`.dash-hot-count`、`.dash-hot-go`。
- 桌面五列（32px 名次 / 名称 24% / 热度条 1fr / 计数 / 箭头 auto）；`.dash-hot-go` 用箭头 `→` 且 `white-space:nowrap`，永远单行；≤640 两行 grid-areas（名次 + 名称 + 计数 + 箭头一行，热度条跨列第二行），不换行溢出。
- 风格：热度条 4px、主题色渐变、名次金色衬线、行 hover `--surface-2`、箭头 hover 右移 3px；不使用红黄电商色。
- 入场：`.dashboard.is-in .dash-hot-fill` 宽度 0→`--bar` 800ms，stagger 40ms；reduced-motion 直接终值。

---

## 23. v1.3 对齐返工规则（审计口径）

1. **KPI 六格**：`.dash-kpis` hairline 网格；`.dash-kpi` flex column + `height:100%`；`.dash-kpi-value` 固定 `min-height:1.1em`、number/unit baseline 对齐（`.dash-kpi-number/.dash-kpi-unit`）；`.dash-kpi-note` **单行 + `text-overflow:ellipsis` + `margin-top:auto`**（完整文案在 `title`），同行 note 基线一致（v1.2 审计 6.3px 差异消除）。
2. **图表卡同行等高**：`.dash-card{height:100%;display:flex;flex-direction:column}`，`.dash-card-note{margin-top:auto}` 底部对齐；`.dash-card-head` `align-items:baseline`，标题与右上说明同基线；四卡同排（7/5 栏）高度差 ≤2px。
3. **技能卡等高/按钮行对齐**：`.skills-grid{align-items:stretch}`、`.skill-card{height:100%;flex column}`、`.skill-card-footer{margin-top:auto}`（含 `.skill-meta + .skill-actions`）；`.skill-tags{max-height:50px;overflow:hidden}` 限 2 行、`.skill-desc` 3 行 clamp；`.skill-actions` 在旧 markup（无 footer）下也 `margin-top:auto` 兜底。projects 页 `.skills-grid--compact` 复用同一套。
4. **网格**：`.model-grid,.skills-grid,.project-grid,.explore-grid{align-items:stretch}`；`.model-card,.project-card{height:100%}`；`.model-foot,.project-actions{margin-top:auto}`。
5. **多宽度**：1440/1280/1024/834/768/390/360 各页无横向溢出（`scrollWidth ≤ innerWidth`）；表格只允许 `.table-scroll` 内部横滚；筛选条允许换行不得撑破容器；页脚列 ≤900 两列、≤520 单列；浮动按钮（AI 助手/回顶）不遮挡正文卡片文字区。
6. **审计回归**：Lead 重跑 7 宽度 × 8 页自动审计，目标 0 溢出 / 0 同行错位（>2px）/ 0 浮动遮挡（>4px）。

---

## 24. v1.3 动效参数

| 场景 | 时长 / 延迟 | 说明 |
|---|---|---|
| KPI / 卡片 rise | 480ms | 一次性淡入上移 10px |
| 柱状图 scaleY | 700ms，stagger 35ms（`--i`） | 从底部生长，无回弹 |
| 环形饼图 | 780ms | scale(.94)+淡入，不旋转抖动 |
| 斩杀线竖条 | 800ms | 自下而上伸展 |
| 热榜热度条 | 800ms，stagger 40ms（`--i`） | 宽度 0→占比 |
| tooltip | 140ms | 淡入 + 上浮 4px |
| `prefers-reduced-motion` | — | 以上动画全部关闭，直接终值 |

---

## 25. v1.3 验收截图点与变更清单

### 25.1 截图验收点（Lead CDP）
1. 首页 1440：KPI 六格等高、note 对齐；R2 柱状图 + 饼图同排等高、header 基线一致；R3 斩杀线 + 热榜同排等高；四卡内边距一致。
2. 首页 5 主题抽验（ivory/noir/jade/rose/graphite）：柱/环/斩杀线/热榜颜色均为主题色；noir 下数据墨水对比可读。
3. 首页 390/360：单列、柱状图 x 轴隔一显示、饼图环+图例上下排列、斩杀线标签不溢出、热榜两行布局；无横向滚动。
4. 斩杀线：log 轴刻度/标签、金色虚线+「斩杀线 $2.00/1M」、生存/斩杀计数（232/212、52.3%）、hover tooltip。
5. 热榜：Top 6-8 名次/热度条/计数/「去看」箭头，hover 行高亮；点击跳 `news.html?tag=`。
6. skills 页 1440/1280/834：三行卡片 footer 顶部对齐（审计 47.6/46.8/24.7px 差异归零）；tags ≤2 行、desc ≤3 行、按钮行贴底。
7. projects 页 Skills 区块：compact 卡等高、footer 对齐。
8. 动效：进入视口后 ≤1s 完成、无弹跳；`prefers-reduced-motion` 终值。

### 25.2 v1.2 → v1.3 CSS 变更清单
| 文件 | 变更 |
|---|---|
| `theme.css` | 新增 token 派生饼图调色板 `--donut-1..5`；压缩冗余注释（省 2.2 KB，规则零变化） |
| `components.css` | 移出 dashboard/skills 段（−12.5 KB）；新增共享技能卡样式与对齐规则（等高/footer 固定/tags 限高/desc clamp）；解除 `.model-*` 与 `.skill-*` 的选择器合并，改为独立共享块；通用部分约 68.4 KB |
| `dashboard.css`（新，仅 index） | KPI 墙 + 12 栏图表卡网格 + 柱状图（y 轴顶部=max/底部=0、均值线、`.dash-bar-value` 金色最大值、≤640 x 轴隔一显示）+ 环形饼图 + 斩杀线（caption 上方标签/生存斩杀分区底色/基线/4 log 刻度）+ 话题热榜（箭头不换行）+ tooltip + 入场动效 + 响应式（约 12.0 KB） |
| `skills.css`（新，仅 skills） | 筛选条 + 使用引导 modal + 提交区三路径 + 代码块/复制 + 响应式（约 6.6 KB） |
| `assistant.css` / `share.css` | 无变更 |

---

## 26. v1.4 CSS 拆分与每页预算

| 文件 | 归属 | 内容 |
|---|---|---|
| `theme.css` / `base.css` | 全站 | token（5 主题）/ 重置与基础排版；v1.4 未新增颜色 token |
| `components.css` | 全站 | 通用组件 + v1.4 榜单 top3 徽章/展开/分发 strip + 压缩后的 hero/masthead + 内容优先密度规则 |
| `dashboard.css` | **仅 index** | KPI 墙、图表轮播、柱状图、环形饼图、斩杀线 2.0 散点、真实热榜、tooltip、动效 |
| `skills.css` | **仅 skills** | 筛选条/引导 modal/提交区/代码块 |
| `compare.css` | **仅 models** | 选择态、浮动对比栏、对比 modal 与粘性表格 |
| `assistant.css` / `share.css` | 全站 | 助手 / 分享（分享卡 canvas 由 ai-share） |

每页 `<link>` 顺序：`theme → base → components → dashboard.css（index）| skills.css（skills）| compare.css（models）→ assistant → share`。

实测体积（v1.4）：一般页 **105.1 KB raw / 20.6 KB gzip**；index **118.4 / 23.6**；skills **111.3 / 22.4**；models **112.0 / 22.5** —— 全部 ≤120 KB / ≤26 KB（index 余量约 1.7 KB）。v1.4 新增样式约 9 KB，通过移除装饰性注释、压缩旧图表现有规则腾出额度（规则零丢失）。

## 27. v1.4 首屏内容优先（hero / masthead 瘦身）

### 27.0 v1.5 统一头部（2026-11-07，用户最终确认）

- **全站统一头部高度**：`.hero-grid` 与 `.page-masthead .container` 均 `height: clamp(400px, 30vw, 460px)`（≥961px），左右两栏 `align-items:stretch`，右侧卡片 `height:100%` 填满；≤960px 高度自动、单列。
- **右侧卡片宽度严格 1/4**：`grid-template-columns: minmax(0, calc(75% - var(--rail-gap))) minmax(0, 25%)`；首页每周速览、各页「概览」卡、仪表盘热榜、DeepSeek aside 同一条 75% 起点。
- **同一高度/同一边线**：所有页面头部带（padding + 固定高度）一致 → 右侧卡片顶边、底边、右缘对齐；下一区块从同一条线开始（首页 dashboard 与各页首个 section 的 padding-top 统一 `clamp(16px,2vw,28px)`）。
- **卡片样式统一**：`surface` + 1px 边框 + `--shadow-float` + 内层金线（::before inset 7px）+ 卡头 `概览 / OVERVIEW`；与首页「本周速览」同款。
- 行动按钮/导语/细排仍在左侧 75% 内；首页周报卡内部压缩（stat padding 8px、value 1.6rem、note/source 小字号）以适配固定高度。
- 全局 `--section-y` 调为 `clamp(44px, 6vw, 84px)`；`.section-head` 底部间距 `clamp(18px,2.4vw,32px)`；`.section-desc` 2 行 clamp；`.filter-bar` 上下 padding 10px；`.board-tabs` 底距 12px；`.rank-panel` padding 收紧。
- `.page-masthead`（基础）：上下 `clamp(26px,3.4vw,52px) / clamp(18px,2.4vw,30px)`；h1 `clamp(1.95rem,3.6vw,3rem)`、上边距 14px；lede 2 行 clamp、上边距 14px；`.masthead-meta` 上边距 18px/上 padding 12px。
- `.page-masthead--compact`（各页启用）：上下 18–34 / 12–22px；h1 `clamp(1.75rem,3.2vw,2.6rem)`、上边距 10px；lede 上边距 10px；meta 收紧；其后首个 `.section` 上 padding `clamp(16px,2vw,28px)`。
- `.hero--compact`（首页最终档）：上下 **10–20 / 14–26px**；标题 `clamp(1.8rem,3.1vw,2.65rem)`、上边距 10px；`.hero-actions` 上边距 12px；fineprint 上边距 10px/上 padding 8px；`.hero-panel` padding 12–18px、`.stat-item` padding 7px（在保留衬线标题+金色细线品牌感的前提下最大化内容露出）。
- 指标（最新审计 56 组 0 overflow / 0 issues）：首内容卡顶部 index@1440 **621px**、rankings **572px**、about **388px**（target ≤620，rankings/about 余量充足）；390 首屏可见 hero 面板（index KPI 首卡 964px，移动端以 hero 面板为首屏内容，未纳入 1440 阈值）。
- 浮动按钮与内容防遮挡：`.to-top` 在 **≤1024px 隐藏**（页面仍可正常滚动，AI 助手入口保留），≥1025px 显示——v1.4 审计 float-overlap 归零；与卡片的 4px 安全间距由审计脚本保障。

## 28. v1.4 榜单 Top10 / top3 徽章 / 分发 strip

- Top3：`td.rank-no--1/2/3` + `span.rank-medal`（19px 圆形，衬线罗马数字 Ⅰ/Ⅱ/Ⅲ），金/香槟/石墨三档内敛配色；数字序号保留；`.rank-row--top3 .rank-model` 字重 500；无 emoji。
- 展开：`.rank-expand`（flex 两端对齐）内 `.rank-expand-note` 说明 + `.btn.btn--ghost.btn--sm` 按钮。
- 分发 strip（榜单卡底部，≤卡片 12%）：`.rank-dist` 一行细 strip，上边 1px `--line` 分隔；56px 二维码（≤640px 44px，白底 `--qr-surface` + 3px 静区）+ `.rank-dist-title` + `.rank-dist-site/.rank-dist-repo`（`--highlight` 下划线，可换行不裁切，对比度 ≥4.5:1）。
- 分享卡 canvas 内的极简 strip 由 ai-share 绘制（CSS 不参与）。

## 29. v1.4 模型对比（compare.css，仅 models）

- 选择态：`.compare-check` 为 label 容器，内含隐藏 `.compare-check-input` + 自绘 16px `.compare-check-box`（checked 时 `--highlight` 填充 + 对勾，focus-visible 焦点环，超上限时 disabled 降透明）；表格首列 `.compare-col`/`.cell-compare` 宽 52px 居中；卡片用 `.compare-check--card`（右上角圆形浮层，`.model-card:has(...)` 给 `.model-card-top` 预留 30px 防遮挡）。
- 浮动对比栏：`.compare-bar`（fixed 底部、毛玻璃、上边 1px line、safe-area padding、**z-index 86**，位于 AI 助手之上不被遮挡）内 `.compare-bar-info`（`.compare-bar-count` 计数 + `.compare-bar-hint` 提示 + `.compare-chips > .compare-chip`（`.compare-chip-name` + `.compare-chip-remove`））+ `.compare-bar-actions`（清空/开始对比，开始按钮 disabled 时降透明）；≤700px 单行横向滚动、提示隐藏、按钮不换行。
- 对比视图：`.compare-modal > .compare-backdrop + .compare-panel`（`min(1100px,100%)`、max-height 88vh、`--r-3`、`--shadow-panel`）；`.compare-head` 标题 + 关闭；`.compare-scroll` 双向滚动。
- 表格：`.compare-table` min-width 760px，`thead` 与首列粘性（背景 `--surface-2`/`--surface`，z-index 分层），列 min-width 168px，模型列 190px（`.compare-col-name` + `.compare-col-sub` 厂商小字）；行首字段 `.compare-field`；缺失 `.compare-cell.is-missing`（muted + 55% 透明显示 —）、最优 `.compare-cell.is-best`（9% 金色底 + `--gold-deep` + 600 字重）；表下 `.compare-table-note` 说明匹配规则与来源。
- 移动端 ≤700px：modal 变底部 sheet（全宽、上圆角、92vh），表格最小 680px 横向滚动；close/remove 焦点环沿用全站。

## 30. v1.4 图表轮播 / 斩杀线散点 / 真实热榜

### 30.1 图表轮播（dashboard.css，index）
- 布局：`.dash-grid--carousel` 两栏（`1.55fr / 1fr`，≥1025px），右侧 `.dash-card--topics` 热榜卡；≤1024px 单列，热榜在轮播下方并两列排布（≤760px 单列）。
- 容器：`.dash-grid--carousel` 用 `--dash-ch`（轮播视口高，默认 480px；≤1024 `clamp(440px,56vw,580px)`；≤760 520px）与 `--dash-cc`（控件高 42px）统一控制；**≥1025px 时 grid 行高 = `calc(var(--dash-ch) + var(--dash-cc))`**，热榜卡同高封顶（§30.3），两栏底部对齐误差 0。视口本身 1px line + `--r-1` + `--shadow-card`，overflow hidden 防跳动；`.dash-carousel-track` flex + `transform` 切换，`transition: transform 520ms --ease`（柔和无弹跳）；`.dash-slide` 直接 flex column（padding 16–22px，内部 `.dash-card-head/.dash-card-body/.dash-card-note`，body flex 居中、note 贴底）。
- 控件：`.dash-carousel-controls` 居中，左右 `.dash-carousel-arrow`（32px 圆形，hover 金边 + 10% 金底）+ `.dash-carousel-dots > .dash-dot`（22×3px 短条，选中 32px + `--highlight`，focus-visible 焦点环）；`hover/focus` 暂停时根加 `.is-paused`（选中 dot 透明度 65%）；≤640px 隐藏箭头、显示 `.dash-carousel-hint` 滑动提示。
- 无 JS 回退：track 内 slide 横向排列，viewport 只显示第一张（不依赖 `is-ready`）；`prefers-reduced-motion` 关闭 track 过渡与 slide 内动画（JS 同时停止自动轮播）。

### 30.2 斩杀线 2.0（能力 × 成本散点）
- SVG `.dash-scatter-svg`（viewBox 900×320 或 640×320，宽 100% 自适应）：底层 4 个 `.dash-quadrant`（is-survival/kill/highcost/lowability）浅底（highlight 7% / ink 4.5% / gold 5% / ink 3%），`.dash-quadrant-label` 10px uppercase muted，生存区标签用 `--highlight` 600 字重。
- 轴：`.dash-axis-x/.dash-axis-y` 内 `.dash-axis-label`（14 用户单位 muted，`--alt` 在 ≤640 隐藏奇数标签）；`.dash-scatter-axis-title` 13 单位（移动 22）/`.dash-scatter-line-label` 12 单位金色（移动 20）；`.dash-quadrant-label` 13 单位（**≤640 隐藏**，以象限浅底+底部规则说明代替，避免 SVG 缩放后过小）；双 P50 线 `.dash-scatter-line--cap`（水平能力中位）/`--cost`（垂直价格中位），`--gold` 虚线；JS 传入的 4 个 `.dash-quadrant.is-survival/is-highcost/is-lowability/is-kill` rect 提供四象限浅底，`.dash-quadrant-label` 为象限标签（生存区用 `--highlight` 600 字重）。
- 点：`.dash-scatter-point` 默认 highlight 50% 透明；存活点 `.is-survive` 实心 `--highlight` + `--gold` 描边（r=6 由 JS 设置），其余 `.is-dead` 用 `--muted` 55%；hover/focus 完全不透明 + `--gold-deep` 描边；键盘可聚焦（tooltip 由 `.dash-tooltip` 显示「模型 · 分数 · $价格」）。
- 注释：`.dash-scatter-meta`（样本数/规则，11px muted）+ `.dash-scatter-disclaimer`（免责，10px muted 85%）；无评分/未匹配时显示空态（不绘制假点）。
- 入场：`.dash-slide.is-active` 时点 420ms stagger 4ms 淡入缩放；reduced-motion 直接终值。

### 30.3 真实热榜（Hacker News）
- `.dash-card--topics` 右侧卡：**≥1025px 与轮播同高**（`max-height:calc(var(--dash-ch) + var(--dash-cc))`，10 条话题在卡内滚动，`scrollbar-width:thin`，底部 note 固定）——修正 v1.4 首屏两栏底部不齐；≤1024px 单列全宽，展示完整列表（body overflow 可见），≤760px 单列。
- `.dash-topics > .dash-topic > a.dash-topic-link`：两列（排名 26px + 内容）；`.dash-topic-title` 2 行 clamp（13px 500 ink）、`.dash-topic-summary` 2 行 clamp（12px muted）、`.dash-topic-meta > .dash-topic-meta-item`（11px muted，points/comments/domain/date，单行省略）+ `.dash-topic-meta-sep`（·分隔）；空态 `.dash-topic-empty`；hover 行底 `--surface-2`、focus-visible 焦点环。
- 桌面单列；≤1024 卡内 2 列；≤760 单列。≤640px 的 meta 精简为「points · comments」（隐藏 domain/date，避免挤成省略号；`>span:nth-child(n+4)` 隐藏）。
- 安全：标题/摘要全部由 JS `esc()` 渲染，外链 `target="_blank" rel="noopener noreferrer"`；CSS 不引入任何资源。

## 31. v1.4 验收截图点与变更清单

### 31.1 截图验收点
1. 首页 1440：hero 高度 ≤560px；仪表盘轮播 3 视图（柱/饼/散点）+ 右侧真实热榜两栏等高；KPI 六格对齐。
2. 轮播控件：dots 选中态、箭头 hover、`is-paused` 暂停态；手动切换后 12s 内不再自动（JS）；390 滑动提示可见、无横向溢出。
3. 斩杀线 2.0：四象限浅底与标签、双 P50 虚线、生存区点金色描边、tooltip、样本数/免责。
4. 真实热榜：标题/摘要 2 行 clamp、points/comments/domain、外链箭头、hover 行；降级空态。
5. rankings 1440/1024/390：top3 徽章（Ⅰ/Ⅱ/Ⅲ + 01）、展开按钮、分发 strip（QR 56/44px、地址清晰、≤12% 高）。
6. models 1440/1024/390：对比选择态、浮动栏（已选 N/6、移除、清空、开始对比）、对比 modal 粘性表头+首列、缺失 —、最优高亮、移动底部 sheet 横向滚动。
7. 各页 1440×900 首内容卡顶部 ≤620px；390×844 首个内容卡可见。
8. 5 主题抽验：散点象限/点、热榜、top3 徽章、对比表 in noir/jade/rose/graphite 均可读。

### 31.2 v1.3 → v1.4 CSS 变更清单
| 文件 | 变更 |
|---|---|
| `components.css` | 新增 v1.4 榜单 top3 徽章（`.rank-no--1/2/3` + `.rank-medal`）、`.rank-expand`、`.rank-dist` 分发 strip；新增 `.page-masthead--compact` / `.hero--compact` 与内容优先密度规则（--section-y、section-head、filter-bar、board-tabs、rank-panel）；≤1024px 隐藏 `.to-top`（回顶按钮遮挡 KPI/技能卡操作行 → float-overlap 归零）；移除装饰性长注释与旧 provisional badge 规则 |
| `dashboard.css` | 重写图表区：`.dash-grid--carousel` 两栏 + `.dash-carousel` 定高轮播 480px（track transform 520ms、dots/箭头/暂停/移动提示、slide 直接 flex column、无 JS 首图）；`.dash-scatter` 散点（四象限 rect/双虚线/`.dash-scatter-point` 生存强调/移动可读）替换旧 killline；`.dash-topics` 真实热榜（meta item/sep）替换旧关键词 bar；动画改为 `.dash-slide.is-active` 触发；移除旧 killline/hot 规则（约 13.3 KB） |
| `compare.css`（新，仅 models） | 对比选择态/浮动栏/对比 modal/粘性表格/缺失与最优/移动 sheet（约 6.9 KB） |
| `theme.css` / `base.css` | `--section-y` 收紧；移除已不用的 `--dash-track`；压缩装饰注释 |
| `skills.css` / `assistant.css` / `share.css` | 注释瘦身；规则不变 |

**补充（markup 集成后）**：v1.4 最终 markup 带来少量新类，CSS 已补齐——`.about-qr-card`（关于页二维码卡片由 2 列 grid 改为 aside 内竖排，140px/移动 112px）、`.footer-address`（全站页脚「本站地址 + 复制 + GitHub + RSS」行）、`.filter-row--meta`（meta 行与 result-count 右对齐）、`.subscribe-address-title`（订阅区地址小标题）、`.tag--more`（技能卡 +N 虚线弱化标签）、`.compare-empty`（对比空态）。同时修复轮播内饼图 `.dash-card-body.dash-donut-wrap` 被 slide flex 规则覆盖成单列的问题（显式 grid 双列）。
