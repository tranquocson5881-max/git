# 奶蛙桌宠（Windows 修改版）

基于 [LynnShaw/naiwa-pet](https://github.com/LynnShaw/naiwa-pet) 源码 fe2523d 修改，保留原项目素材和出处。本目录为独立 Tauri 项目。

## 功能

- 单击松开播放大笑动画和声音；移动超过 6 像素才拖动，修复 Windows 点击被拖动截走的问题。
- 右键「再来一只」增加桌宠；「减少一只」关闭当前窗口。
- 右键「自由移动」开关：在当前屏幕工作区内缓慢移动，碰到边缘转向；鼠标悬停暂停，手动拖动会关闭自由移动。
- 右键「尺寸设定」切换六种尺寸。
- 右键「关闭」退出本程序并关闭所有奶蛙窗口。

## Windows 运行与构建

需要 Node.js、Rust stable（MSVC）、Visual Studio Build Tools 的 C++ 桌面开发组件和 Windows SDK，以及 Microsoft Edge WebView2 Runtime。

在本目录运行：

```sh
npm ci
npm run tauri:dev
```

构建：

```sh
npm run tauri:build
```

免安装可执行文件：`src-tauri/target/release/naiwa-pet.exe`；安装包目录：`src-tauri/target/release/bundle`。可使用 `npm run tauri:build -- --no-bundle` 仅生成可执行文件。若找不到 link.exe，请在 Visual Studio x64 Native Tools 命令环境中构建。

## 检查

```sh
node verify-interaction.mjs
node verify-movement.mjs
npm run build
```

事件检查覆盖单击、轻微移动、拖动、右键、取消和连续点击；移动检查覆盖边界、悬停暂停、关闭和旧异步操作取消。

## 素材与来源

原始动画、声音、图标及视频打包在 `asset-bundle/` 中。首次运行或构建时自动校验 SHA-256 并解包，恢复 `public/pets/naiwa/`、`src-tauri/icons/` 和原视频。可单独运行 `npm run assets:unpack`。系统需要 tar（Windows 10/11、macOS 和常见 Linux 默认提供）。不需要重新生成动画帧。`naiwa.mp4` 是原始素材；重新生成需安装 FFmpeg 后运行 `npm run assets:naiwa`。原项目的大体积展示图未随本目录复制，可在[原项目](https://github.com/LynnShaw/naiwa-pet)查看演示。

原代码及角色、音视频素材的权利归各自权利人所有，本修改未赋予额外授权。
