<h1 align="center">halo-theme-dream2.0-plus</h1>

<p align="center">
<a href="https://github.com/halo-dev/halo"><img alt="Halo version" src="https://img.shields.io/badge/halo-2.24.2%2B-brightgreen?style=flat-square" /></a>
<a href="https://github.com/hcjike/halo-theme-dream2.0-plus/releases"><img alt="releases" src="https://img.shields.io/github/release/hcjike/halo-theme-dream2.0-plus.svg?style=flat-square"/></a>
<a href="https://github.com/hcjike/halo-theme-dream2.0-plus/blob/master/LICENSE"><img alt="license" src="https://img.shields.io/github/license/hcjike/halo-theme-dream2.0-plus?style=flat-square"/></a>
<a href="https://github.com/hcjike/halo-theme-dream2.0-plus/releases"><img alt="downloads" src="https://img.shields.io/github/downloads/hcjike/halo-theme-dream2.0-plus/total.svg?style=flat-square"/></a>
<a href="https://github.com/hcjike/halo-theme-dream2.0-plus/commits"><img alt="commits" src="https://img.shields.io/github/last-commit/hcjike/halo-theme-dream2.0-plus.svg?style=flat-square"/></a>
<a href="https://afdian.com/a/org-hcjike"><img alt="donate" src="https://img.shields.io/badge/$-donate-ff69b4.svg?style=flat-square"/></a>
</p>

本仓库为 `Halo 2.x` 主题仓库。

## 主题预览

| 站点名    | 预览地址 | 
| ----------- |----------|
| 宏尘极客     | [https://www.hcjike.com](https://www.hcjike.com)  |


## 主题文档
> [halo-theme-dream2.0 主题设置](https://www.hcjike.com/docs/halo-theme-dream2.0)
> 
> [插件相关配置](https://www.hcjike.com/docs/halo-theme-dream2.0/theme/setting/plugins)
> 
> [新版朋友圈配置说明](https://www.hcjike.com/archives/NCUHxYWz)
> 
> [留言板配置说明](https://www.hcjike.com/archives/Up0w1lxf)
> 
> [配置全局默认版权协议](https://www.hcjike.com/archives/uFXXQxld)

**温馨提示：若您遇到问题，请首先查阅相关文档。对于文档中已明确说明的事项，将不再另行答复。**

## 版本适配关系

| 主题版本    | 适配Halo版本 | 测试用Halo版本 |
|---------|----------| -------------- |
| 1.16.0+ | 2.24.2+  | 2+     |
| 1.14.0+ | 2.23.0+  | 2+     |
| 1.11.1+ | 2.22.1+  | 2+     |
| 1.11.0+ | 2.22.0+  | 2+     |
| 1.6.6+  | 2.21.0+  | 2+     |
| 1.5.3+  | 2.20.19+ | 2+     |
| 1.3.1+  | 2.20.0+  | 2+     |

## 安装 & 更新

1. 进入主题 [Release](https://github.com/hcjike/halo-theme-dream2.0-plus/releases/latest) 界面，下载主题压缩包 `theme-dream2-plus-xxx.zip` 压缩包文件，`xxx` 为版本号；
2. 进入博客后台管理 `主题->主题管理->安装主题`，选择下载的 `theme-dream2-plus-xxx.zip` 安装包进行上传；
3. 等待安装完成；
4. 更新方法同上。


## 参与主题开发

1. 开发环境准备
    - 安装 `nodejs` 版本需要在 `15+`，建议使用 `22+`；
    - 主题目录下执行 `npm i` 安装依赖；
    - 开发时建议使用 `npm run dev` 进行打包，用于安装调试，此命令无需手动修改版本号，每次打包都会自动更新版本号；
    - 提交PR时，如非必要请不要提交 `theme.yaml`、`package.json`、`package-lock.json`、`.eslintrc.js` 文件；


2. npm 命令
   
    - `npm run lint` 执行代码风格校验。
    - `npm run zip` 执行安装包打包，在无须重新编译 `js/css` 时使用。

    - `npm run build-res --tag=$version` 用于编译特定版本资源，在工作流中发布npm使用，主题中 `src` 目录下的 `js` 和 `css` 文件将会被编译为 `assets` 目录下的文件，同时 `assets` 目录下的文件将会被更新。
    - `npm run dev` 执行主题打包操作，根据执行时间打包生成 `0.0.yyyyMMddHHmmss` 格式的版本号，用于测试环境安装调试。

    - `npm run build` 执行主题打包操作，主题将被打包为压缩包文件存放在 `dist/` 目录下，同时 `assets` 目录下的文件也将被更新。
    - `npm run build --devel` 开发模式进行主题打包，`js` 和 `css` 不会被做压缩和混淆处理，方便排查问题。
    - `npm run release --tag=$version` 发布模式执行主题打包操作，将自动更新主题中的版本号，并使用这个版本标签重新创建  `FreeCDN` 清单文件。

