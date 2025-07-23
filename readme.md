# koishi-plugin-ehentai-comics

[![npm](https://img.shields.io/npm/v/koishi-plugin-ehentai-comics?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ehentai-comics)
[![license](https://img.shields.io/github/license/WhiteBr1ck/koishi-plugin-ehentai-comics?style=flat-square)](https://github.com/WhiteBr1ck/koishi-plugin-ehentai-comics/blob/main/LICENSE)

一个为 [Koishi](https://koishi.chat/) 设计的插件，用于在 E-Hentai 或 ExHentai 上搜索、浏览和下载漫画。

## ✨ 功能

- **漫画搜索**：通过关键词在 E-Hentai / ExHentai 上搜索画廊。
- **结果展示**：以图文形式展示搜索结果，支持合并转发。
- **漫画下载**：
  - **图片模式**：将整个画廊的图片逐张或以合并转发的形式发送。
  - **PDF 模式**：将整个画廊下载并合成为一个加密或未加密的 PDF 文件发送。
- **高度可配置**：支持配置 ExHentai Cookie、图片压缩、发送方式、下载并发等多种选项。

## 💿 安装

在 Koishi 插件市场搜索 `ehentai-comics` 并安装。

或在你的 Koishi 项目根目录下执行：
```bash
npm install koishi-plugin-ehentai-comics
```
然后，在 Koishi 的插件市场或配置文件中启用本插件。

## 📖 使用

### 指令

- `ehsearch <关键词>`: 搜索漫画。
  - 示例: `ehsearch fate grand order`
- `ehdownload <画廊URL>`: 下载指定的漫画。
  - 选项:
    - `-o, --output <type>`: 指定输出类型。`image` (图片) 或 `pdf` (PDF文件)。不指定则遵循配置项。
  - 示例: `ehdownload https://e-hentai.org/g/xxxx/xxxxxxxxxx/`
  - 示例 (强制输出为图片): `ehdownload https://e-hentai.org/g/xxxx/xxxxxxxxxx/ -o image`

### ⚙️ 配置项

你可以在 Koishi 的配置文件中对本插件进行详细配置。

#### 站点与登录设置

- **`site`**: 选择要使用的站点。
  - `e-hentai.org`: E-Hentai (免费)
  - `exhentai.org`: ExHentai (需要登录)
  - **默认值**: `e-hentai.org`
- **`ipb_member_id`**: (可选) 你的 `ipb_member_id` Cookie 值，用于登录 ExHentai。
- **`ipb_pass_hash`**: (可选) 你的 `ipb_pass_hash` Cookie 值，用于登录 ExHentai。

#### 🍪 如何获取 ExHentai Cookie？

1.  **登录账号**: 在你的电脑浏览器 (如 Chrome / Edge / Firefox) 中，登录你的 E-Hentai 账号。
2.  **访问 ExHentai**: 成功登录后，访问 `https://exhentai.org`。如果你能正常看到网站内容，说明你的账号有权限。
3.  **打开开发者工具**:
    *   在页面上按下 `F12` 键。
    *   或者右键点击页面，选择“检查”。
4.  **找到 Cookie**:
    *   在打开的开发者工具面板中，找到并点击 **`Application`** (应用) 选项卡。
    *   在左侧的菜单中，展开 **`Cookies`** 项，然后点击下面的 `https://exhentai.org`。
5.  **复制 Cookie 值**:
    *   右侧会显示一个 Cookie 列表。在列表中找到名为 `ipb_member_id` 和 `ipb_pass_hash` 的两项。
    *   分别双击这两项的 `Value` (值) 列，将其中的字符串完整地复制出来。
    *   将复制好的值粘贴到上面插件配置的相应字段中。

#### 消息发送设置

- **`searchResultCount`**: 搜索结果显示的数量。
  - **范围**: 1 - 25
  - **默认值**: `10`
- **`useForwardForSearch`**: (QQ平台) 是否默认使用合并转发的形式发送【搜索结果】。
  - **默认值**: `true`
- **`useForwardForImages`**: (QQ平台) 当以图片形式发送漫画时，是否默认使用【合并转发】。
  - **默认值**: `true`
- **`showImageInSearch`**: 是否在【搜索结果】中显示封面图片。
  - **默认值**: `true`

#### PDF 设置

- **`downloadPath`**: PDF 文件和临时文件的保存目录。
  - **默认值**: `./data/downloads/ehentai`
- **`defaultToPdf`**: 是否默认将漫画下载为 PDF 文件。
  - **默认值**: `true`
- **`pdfPassword`**: (可选) 为生成的 PDF 文件设置一个打开密码。留空则不加密。
- **`enableCompression`**: (PDF模式) 是否启用图片压缩以减小 PDF 文件体积。
  - **默认值**: `true`
- **`compressionQuality`**: (PDF模式) JPEG 图片质量 (1-100)。
  - **默认值**: `80`
- **`pdfSendMethod`**: PDF 发送方式。如果 Koishi 与机器人客户端不在同一台设备或 Docker 环境中，必须选择“Buffer”。
  - `buffer`: Buffer (内存模式，最高兼容性)
  - `file`: File (文件路径模式，低兼容性)
  - **默认值**: `buffer`

#### 下载与调试设置

- **`downloadConcurrency`**: (图片/PDF模式) 下载漫画图片时的并行下载数量。数值越低越稳定。
  - **默认值**: `5`
- **`downloadTimeout`**: (高级) 单张图片下载的超时时间（秒）。
  - **默认值**: `30`
- **`downloadRetries`**: (高级) 单张图片下载失败后的自动重试次数。
  - **默认值**: `3`
- **`scrapeDelay`**: (高级) 每次抓取网页之间的延迟（秒），以防止IP被封禁。
  - **默认值**: `1`
- **`debug`**: 是否在控制台输出详细的调试日志。用于排查问题。
  - **默认值**: `false`

## ⚠️ 免责声明

1.  本插件仅为个人学习和技术研究目的而开发，不得用于任何商业或非法用途。
2.  用户通过本插件访问和下载的所有内容均来自第三方网站 (E-Hentai/ExHentai)，本插件不对这些内容的合法性、准确性或适当性负责。
3.  用户在使用本插件时，必须严格遵守其所在国家或地区的法律法规，以及目标网站（E-Hentai/ExHentai）的用户协议和服务条款。
4.  对于因使用本插件而可能导致的任何后果，包括但不限于IP被封禁、法律纠纷或对用户设备造成的任何损害，开发者概不负责。
5.  请在下载和传播任何内容前，确认你拥有这样做的合法权利。使用本插件即代表你已阅读并同意以上条款。

## 📜 开源许可

本项目使用 [MIT License](./LICENSE) 开源。

Copyright (c) 2025 WhiteBr1ck (https://github.com/WhiteBr1ck)