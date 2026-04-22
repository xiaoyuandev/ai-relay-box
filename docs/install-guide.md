# Clash for AI 安装说明

## 下载安装包

请在 GitHub Releases 页面下载与你系统匹配的安装包。

### macOS

优先选择：

1. Apple Silicon Mac: `arm64`
2. Intel Mac: `x64`

常见文件：

1. `.dmg`
2. `.zip`

推荐优先使用 `.dmg`。

### Windows

优先选择：

1. `x64-setup.exe`
2. 如果未来提供 `arm64` 安装包，则 Windows on ARM 设备优先使用 `arm64`

### Linux

优先选择：

1. `AppImage`
2. `tar.gz`

普通桌面用户建议优先使用 `AppImage`。

## 首次启动提示

### macOS

当前版本采用免费分发方案：

1. 没有 Apple Developer ID
2. 不做 notarization
3. 使用 ad-hoc 打包

因此首次打开时，系统可能提示应用来自未识别开发者。

如果被拦截，可以这样处理：

1. 在 Finder 中右键应用
2. 选择 `打开`
3. 再次确认打开

或者：

1. 进入 `系统设置`
2. 打开 `隐私与安全性`
3. 在安全提示区域允许该应用继续打开

### Windows

当前版本未做代码签名，因此 SmartScreen 可能弹出未知发布者提示。

如果遇到提示：

1. 点击 `更多信息`
2. 再点击 `仍要运行`

### Linux

如果使用 `AppImage`，第一次运行前通常需要先赋予可执行权限：

```bash
chmod +x "Clash for AI-<version>-x64.AppImage"
./Clash\ for\ AI-<version>-x64.AppImage
```

## 安装后检查

首次打开应用后，建议确认以下几点：

1. 界面能正常打开
2. 顶部状态显示 `core running`
3. 能看到当前 `connected api base`
4. 可以成功添加并激活 Provider

## 常见说明

1. 应用已经自带本地 gateway core，不需要额外安装 Go。
2. 自动更新只在安装包构建版本中可用，开发模式不可用。
3. 未签名安装包在 macOS 和 Windows 上出现安全提示属于预期行为。
