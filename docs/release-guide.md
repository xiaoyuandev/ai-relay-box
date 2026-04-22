# Clash for AI 发布说明

## 当前发布策略

Clash for AI 采用 Electron + electron-builder 打包，并通过 GitHub Release 分发安装包和自动更新元数据。

当前支持：

1. macOS
2. Windows
3. Linux

## 核心发布原则

1. Go core 必须随桌面应用一起分发，不能依赖用户本地安装 Go。
2. 每个平台在自己的原生 CI runner 上打包，避免跨平台交叉打包的不稳定性。
3. 开源免费分发优先，不依赖 Apple Developer 付费账号。

## 免费分发方案

### macOS

当前使用免费分发方案：

1. 不做 Apple notarization
2. 没有 Developer ID 时允许 electron-builder 使用 ad-hoc 签名

这意味着：

1. 安装包可以构建和分发
2. 用户首次打开时，macOS 可能提示应用来自未识别开发者
3. 用户通常需要右键应用并选择 `打开`，或在系统设置中手动放行

这适合作为开源项目的早期公开测试版或社区分发版，但不属于最顺滑的商业级安装体验。

### Windows

当前不做代码签名。

这意味着：

1. 安装包可以正常构建
2. Windows SmartScreen 可能提示未知发布者

### Linux

当前发布：

1. `AppImage`
2. `tar.gz`

其中 `AppImage` 更适合普通用户直接下载使用。

## 本地构建命令

在仓库根目录执行：

```bash
pnpm install
pnpm --filter desktop build:mac
pnpm --filter desktop build:win
pnpm --filter desktop build:linux
```

说明：

1. 打包前会先构建 Electron 前端和主进程
2. 然后构建当前平台对应的 `core/bin/clash-for-ai-core`
3. 最后再把 core 二进制打进安装包资源目录

## GitHub Actions 发布

推送 tag 后自动发布：

```bash
git tag v0.1.0
git push origin v0.1.0
```

工作流会在以下 runner 上分别打包：

1. `macos-latest`
2. `windows-latest`
3. `ubuntu-latest`

然后将产物上传到同一个 GitHub Release。

建议在创建 Release 时复用模板：

- [GitHub Release Template](../.github/release-template.md)

同时把用户安装说明一起挂到发布页：

- [Install Guide](./install-guide.md)

## 上线前检查项

1. 启动打包后的应用，确认 core 能自动启动
2. 在未安装 Go 的环境中验证应用仍可运行
3. 检查自动更新元数据是否上传到 GitHub Release
4. 检查 macOS、Windows 首次启动提示是否符合预期
5. 在 README 或发布页明确说明未签名带来的系统提示
