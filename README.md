# dsh-pwa-ui

中文 | [English](README.en.md)

DeepSeek Harness（`dsh`）Web 插件：让**已安装**的 Web 应用拥有原生观感的窗口标题栏，基于
[Window Controls Overlay](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/window-controls-overlay)
API。

它不额外画一条标题栏：清单启用 overlay 之后，应用**自身的**界面就是窗口标题栏 —— 侧边栏的 logo 行与会话 header 所在的顶部条带就是拖动窗口的位置，应用自己的控件则自动让开系统窗口按钮。

![已安装应用的窗口：应用自身的 logo 行与会话 header 就是标题栏](assets/screenshot-1.png)

## 安装

```sh
dsh plugin --profile web add @liuzw/dsh-pwa-ui
```

重启 `dsh web`（清单路由在启动时接管），然后在 Edge 或 Chrome 里把界面安装成应用：地址栏 → **安装**。应用窗口打开后，它自己的 header 就是标题栏。

不想安装也可以先看效果：Microsoft Edge DevTools → **应用程序 → 窗口控件叠加**（Window Controls Overlay）可模拟 overlay；即使 `navigator.windowControlsOverlay` API 仍不可见，插件也会把模拟出来的 `env()` 几何当成已启用 overlay 处理。

## 做了什么

| 半身 | 文件 | 职责 |
| --- | --- | --- |
| 主机 | `index.js` | 接管精确路由 `/manifest.webmanifest`，在自带的 manifest 之上把 `display_override: ["window-controls-overlay"]` 放在首位返回；其余字段（`name`、`short_name`、`start_url`、`scope`、`display`、`icons`）原样透传 `@deepseek-ai/dsh-web-frontend/dist/manifest.webmanifest`，只有读不到时才用内置副本兜底。`display: "fullscreen"` 仍作为回退模式，因此不支持 overlay 的平台行为不变。 |
| 浏览器 | `client.js` | overlay 可见期间在 `<html>` 上发布 `data-dsh-wco` 标记并注入一份样式表，卸载时全部回收。 |

### 标题栏就是应用自己的界面

shell 本来就声明了哪些行在桌面窗口下是拖拽把手：侧边栏品牌行与会话 header 自带 `data-window-drag`，`ui-web` 的 base.css 把这个标记变成 macOS 的拖拽规则。浏览器半身复用它，而不是另造 chrome：

- `html[data-dsh-wco] [data-window-drag]` 成为 `app-region: drag` 把手，于是 logo 行与会话 header 都能拖动窗口，和桌面版的行为一致。
- 应用自身控件通过同一份 `no-drag` 名单（`button`、`a`、`[role=tab]` 等）加应用自己的 `data-window-drag-recall` 标记保持可点击。
- 侧边栏根容器自带的 `6px` 顶边 / `--dsh-sidebar-inline-padding` 盒子在品牌行上用负外边距抵消、再把同样的内缩作为行内 padding 加回，于是品牌行的边框盒（也就是拖拽区）能贴到窗口左上角，而内容一个像素都不移动。
- `--dsh-wco-controls-start` / `--dsh-wco-controls-end` 量的是浏览器标题栏 chrome 占用的条带（Windows 在右、macOS 在左；Edge 上这条带包含浏览器的全部按钮，不只是最小化/最大化/关闭）。只有真正占据窗口右边缘的那个面才吃这个内缩——展开的右侧栏内缩它自己的 dock 标签条，未展开时改由会话 header 承担。侧边栏品牌行与 dock 的前导内缩取 `controls-start`，因此 macOS 的红绿灯不会压到应用控件。
- 同时发布 `--dsh-frame-leading-clearance` 与 `--dsh-frame-overlay-top`，让 frame 的标题行和弹窗/浮层避开控件；`--dsh-frame-chrome-top` 故意不动——现在标题栏是应用内容，模态遮罩本就该盖住它。

## 要求

- DSH 的 **web** profile（`dsh web`）；桌面/Electron 窗口有各自的 `data-platform="darwin"` / `data-windows-titlebar` chrome，不受影响。
- 支持 Window Controls Overlay 的浏览器并已安装该应用：Windows/macOS 上的 Edge 或 Chrome。必须是安装后的应用——普通浏览器标签页里 `navigator.windowControlsOverlay.visible` 为假且 `env(titlebar-area-height)` 解析为 `0px`，因此不画任何东西、不预留空间、布局完全不变。

## 说明与已知耦合

- 零依赖、无构建步骤：包内就是原生 ES 模块，可从 npm 或直接从仓库安装。
- **标题栏 chrome 的背景**：刷新时浏览器偶尔先把它自己那层背景画在标题栏按钮后面，随后才被应用的重绘覆盖，右上角因此出现一瞬颜色不一致。这正是
  [`::window-controls-overlay`](https://github.com/WICG/window-controls-overlay/issues/67)
  提案要解决的问题；插件已写入 `::window-controls-overlay { background: transparent }`
  （两种写法各为一条独立规则，避免未支持的形式连带作废另一条）——该提案尚未实现，当前浏览器会把它们当未知选择器丢弃，等它落地后即自动生效、无需再改插件。在那之前，能影响这层背景的只有 manifest 的 `theme_color`。
- 插件对准的是自带前端的钩子，前端改版时可能需要跟着更新：`data-window-drag` 标记、右侧栏的 `data-sidebar-right-panel` / `data-sidebar-right-open` / `data-dockkit-float` 属性与 `--dsh-dockkit-strip-inline-start`，以及若干被重述的值（会话 header 的 `28px` 右侧内边距、dock 标签条的 `6px`、品牌行的 `4px` 前导内边距与 `60px` / `36px` 行高、侧边栏根容器的 `6px` 盒子）和 `_logoRow` / `_root` / `_collapsed` / `_headerBlank` / `_headerSessionless` / `_tabStrip` 这几个 CSS-module 后缀。
- 预留条带的宽度是量出来的、不是猜的：Edge 上这条浏览器 chrome 可能有几百像素宽，应用右侧控件就是按这个宽度让位的。
- macOS 分支已实现（通过同一组变量做前导让位），但没有在真实 macOS 窗口上验证。

## 许可

MIT
