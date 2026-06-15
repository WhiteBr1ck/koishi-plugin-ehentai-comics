# koishi-plugin-ehentai-comics

[![npm](https://img.shields.io/npm/v/koishi-plugin-ehentai-comics?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ehentai-comics)
[![license](https://img.shields.io/github/license/WhiteBr1ck/koishi-plugin-ehentai-comics?style=flat-square)](https://github.com/WhiteBr1ck/koishi-plugin-ehentai-comics/blob/main/LICENSE)

一个为 [Koishi](https://koishi.chat/) 设计的插件，用于在 E-Hentai 或 ExHentai 上搜索、浏览和下载漫画。

## ✨ 功能

- **漫画搜索**：通过关键词在 E-Hentai / ExHentai 上搜索画廊。
- **结果展示**：以图文形式展示搜索结果，支持合并转发、封面显示、标题语言偏好和多标题展示。
- **搜索后选择下载**：搜索结果会显示序号，发起搜索的用户可以在有效期内输入序号下载，或输入 `q` 取消。
- **自动链接下载**：可选自动识别普通消息中的 E-Hentai / ExHentai 画廊链接并下载。
- **漫画下载**：
  - **图片模式**：将整个画廊的图片逐张或以合并转发的形式发送。
  - **PDF 模式**：将整个画廊下载并合成为一个加密或未加密的 PDF 文件发送，支持发送后保留本地文件。
- **高度可配置**：支持配置 ExHentai Cookie、图片压缩、发送方式、下载并发、密码发送、标题混淆等多种选项。

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
  - 搜索结果会显示序号。启用序号下载后，发起搜索的用户可以在有效期内输入序号下载对应结果，或输入 `q` 取消。
  - 示例: `ehsearch fate grand order`
  - 示例: 搜索后输入 `1` 下载第一个结果。
  - 示例: 搜索后输入 `q` 取消本次选择。
- `ehdownload <画廊URL>`: 下载指定的漫画。
  - 选项:
    - `-o, --output <type>`: 指定输出类型。`image` (图片) 或 `pdf` (PDF文件)。不指定则遵循配置项。
  - 示例: `ehdownload https://e-hentai.org/g/xxxx/xxxxxxxxxx/`
  - 示例 (强制输出为图片): `ehdownload https://e-hentai.org/g/xxxx/xxxxxxxxxx/ -o image`
- 自动链接下载: 启用配置项后，机器人会自动识别普通消息中的 E-Hentai / ExHentai 画廊链接并下载。
  - 默认关闭，需要在配置项中启用 `enableAutoLinkDownload`。

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
- **`splitMessagesInSearch`**: 【搜索结果】是否将文本和图片分开。
  - **默认值**: `false`
- **`enableAutoLinkDownload`**: 是否自动识别消息中的 E-Hentai/ExHentai 画廊链接并下载。
  - **默认值**: `false`
- **`autoLinkDownloadOutput`**: 自动识别链接时的下载格式。
  - `default`: 跟随默认下载设置
  - `pdf`: PDF
  - `image`: 图片
  - **默认值**: `default`
- **`enableSearchIndexDownload`**: 搜索后是否允许发起搜索的用户输入序号下载对应结果，或输入 `q` 取消。
  - **默认值**: `true`
- **`searchSelectionTimeout`**: 搜索结果序号选择的有效期，单位秒。
  - **默认值**: `120`
- **`galleryTitleDisplay`**: 搜索结果和下载文件名优先使用的标题语言。
  - `default`: 站点页面默认标题
  - `english`: 英文标题
  - `japanese`: 日文标题
  - `all`: 全部可用标题
  - **默认值**: `default`
  - 说明: E-Hentai API 通常只提供英文标题和日文标题，不是任意语言全集。

#### PDF 设置

- **`downloadPath`**: PDF 文件和临时文件的保存目录。
  - **默认值**: `./data/downloads/ehentai`
- **`defaultToPdf`**: 是否默认将漫画下载为 PDF 文件。
  - **默认值**: `true`
- **`pdfPassword`**: (可选) 为生成的 PDF 文件设置一个打开密码。留空则不加密。
- PDF 生成使用纯 JavaScript 实现，不需要用户额外安装本地编译工具。
- **`keepLocalFiles`**: 下载并发送完成后，是否保留生成的 PDF 本地文件。关闭时会沿用默认逻辑，发送后自动删除。
  - **默认值**: `false`
- **`sendPdfPasswordAfterDownload`**: 任务完成后是否发送 PDF 打开密码。仅在配置了 `pdfPassword` 时生效。
  - **默认值**: `false`
- **`enableTitleObfuscation`**: 是否启用标题混淆以规避审核。在PDF文件名的每个字符之间插入指定字符。
  - **默认值**: `false`
- **`titleObfuscationChar`**: 标题混淆时插入的字符。
  - **默认值**: `.`
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

## 📝 更新日志

### v0.2.0
- 新增自动识别 E-Hentai / ExHentai 画廊链接并下载的功能，默认关闭，可通过 `enableAutoLinkDownload` 启用。
- 新增搜索结果序号下载功能。搜索后发起搜索的用户可在有效期内输入序号下载，或输入 `q` 取消。
- 新增 `searchSelectionTimeout` 配置项，用于控制搜索结果序号选择有效期。
- 新增标题语言显示配置 `galleryTitleDisplay`，支持默认标题、英文标题、日文标题和全部可用标题展示。
- 新增 `keepLocalFiles` 配置项，可选择发送 PDF 后是否保留生成的本地文件。
- 新增 `sendPdfPasswordAfterDownload` 配置项，可选择任务完成后是否发送 PDF 打开密码。
- PDF 生成后端由 `muhammara` 迁移到 `pdfkit`，保留 PDF 密码加密能力，同时降低原生模块 ABI 不兼容导致的安装和加载失败风险。
- 重构下载流程，命令下载、自动链接下载和搜索序号下载现在复用同一套下载逻辑。

### v0.1.3
- 新增PDF文件名混淆功能，可在文件名中插入字符规避QQ审核
- 添加 `enableTitleObfuscation` 和 `titleObfuscationChar` 配置项

## ⚠️ 免责声明

1.  本插件仅为个人学习和技术研究目的而开发，不得用于任何商业或非法用途。
2.  用户通过本插件访问和下载的所有内容均来自第三方网站 (E-Hentai/ExHentai)，本插件不对这些内容的合法性、准确性或适当性负责。
3.  用户在使用本插件时，必须严格遵守其所在国家或地区的法律法规，以及目标网站（E-Hentai/ExHentai）的用户协议和服务条款。
4.  对于因使用本插件而可能导致的任何后果，包括但不限于IP被封禁、法律纠纷或对用户设备造成的任何损害，开发者概不负责。
5.  请在下载和传播任何内容前，确认你拥有这样做的合法权利。使用本插件即代表你已阅读并同意以上条款。

## 📜 开源许可

本项目使用 [MIT License](./LICENSE) 开源。

Copyright (c) 2025 WhiteBr1ck (https://github.com/WhiteBr1ck)
