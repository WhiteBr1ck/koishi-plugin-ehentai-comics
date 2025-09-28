import { Context, Schema, Logger, h, Session, sleep } from 'koishi'
import * as path from 'path'
import { mkdir, rm, readFile, unlink, rename } from 'fs/promises'
import { pathToFileURL } from 'url'
import { Recipe } from 'muhammara'
import sharp from 'sharp'
import { load } from 'cheerio'

export const name = 'ehentai-comics'
export const inject = {
  required: ['http'],
}

const logger = new Logger(name)

const galleryUrlRegex = /(e-hentai\.org|exhentai\.org)\/g\/(\d+)\/([a-f0-9]+)\/?/

// Helper function to convert buffer to Data URI
function bufferToDataURI(buffer: Buffer, mime = 'image/jpeg'): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export interface Config {
  site: 'e-hentai.org' | 'exhentai.org'
  ipb_member_id?: string
  ipb_pass_hash?: string
  igneous?: string
  searchResultCount: number
  useForwardForSearch: boolean
  useForwardForImages: boolean
  showImageInSearch: boolean
  splitMessagesInSearch: boolean // [!code ++]
  downloadPath: string
  defaultToPdf: boolean
  pdfPassword?: string
  enableTitleObfuscation: boolean
  titleObfuscationChar: string
  enableCompression: boolean
  compressionQuality: number
  pdfSendMethod: 'buffer' | 'file'
  downloadConcurrency: number
  downloadTimeout: number
  downloadRetries: number
  scrapeDelay: number
  debug: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    site: Schema.union([
      Schema.const('e-hentai.org').description('E-Hentai (免费)'),
      Schema.const('exhentai.org').description('ExHentai (需要登录)'),
    ]).description('选择要使用的站点。').default('e-hentai.org'),
    ipb_member_id: Schema.string().description('（可选）您的 `ipb_member_id` Cookie 值，用于登录 ExHentai。').role('secret'),
    ipb_pass_hash: Schema.string().description('（可选）您的 `ipb_pass_hash` Cookie 值，用于登录 ExHentai。').role('secret'),
    igneous: Schema.string().description('（可选）您的 `igneous` Cookie 值，登录 ExHentai 时可能需要。').role('secret'),
  }).description('站点与登录设置'),

  Schema.object({
    searchResultCount: Schema.number().min(1).max(25).step(1).role('slider').default(10).description('搜索结果显示的数量。'),
    useForwardForSearch: Schema.boolean().description('【QQ平台】是否默认使用合并转发的形式发送【搜索结果】。').default(true),
    useForwardForImages: Schema.boolean().description('【QQ平台】当以图片形式发送漫画时，是否默认使用【合并转发】。').default(true),
    showImageInSearch: Schema.boolean().description('是否在【搜索结果】中显示封面图片。').default(true),
    splitMessagesInSearch: Schema.boolean().description('【搜索结果】是否将文本和图片分开。').default(false), // [!code ++]
  }).description('消息发送设置'),
  
  Schema.object({
    downloadPath: Schema.string().description('PDF 文件和临时文件的保存目录。').default('./data/downloads/ehentai'),
    defaultToPdf: Schema.boolean().description('是否默认将漫画下载为 PDF 文件。').default(true),
    pdfPassword: Schema.string().role('secret').description('（可选）为生成的 PDF 文件设置一个打开密码。留空则不加密。'),
    enableTitleObfuscation: Schema.boolean().description('是否启用标题混淆以规避审核。').default(false),
    titleObfuscationChar: Schema.string().description('标题混淆时插入的字符。').default('.'),
    enableCompression: Schema.boolean().description('【PDF模式】是否启用图片压缩以减小 PDF 文件体积。').default(true),
    compressionQuality: Schema.number().min(1).max(100).step(1).role('slider').default(80)
      .description('【PDF模式】JPEG 图片质量 (1-100)。'),
    pdfSendMethod: Schema.union([
      Schema.const('buffer').description('Buffer (内存模式，最高兼容性)'),
      Schema.const('file').description('File (文件路径模式，低兼容性)'),
    ]).description('PDF 发送方式。如果 Koishi 与机器人客户端不在同一台设备或 Docker 环境中，必须选择“Buffer”。').default('buffer'),
  }).description('PDF 设置'),

  Schema.object({
    downloadConcurrency: Schema.number().min(1).max(10).step(1).description('【图片/PDF模式】下载漫画图片时的并行下载数量。数值越低越稳定。').default(5),
    downloadTimeout: Schema.number().min(1).default(30).description('【高级】单张图片下载的超时时间（秒）。'),
    downloadRetries: Schema.number().min(0).max(5).step(1).description('【高级】单张图片下载失败后的自动重试次数。').default(3),
    scrapeDelay: Schema.number().min(0.2).default(1).description('【高级】每次抓取网页之间的延迟（秒），以防止IP被封禁。'),
    debug: Schema.boolean().description('是否在控制台输出详细的调试日志。用于排查问题。').default(false),
  }).description('下载与调试设置'),
])

export function apply(ctx: Context, config: Config) {
  if (config.site === 'exhentai.org') {
    if (config.ipb_member_id && config.ipb_pass_hash) {
      logger.info(`ExHentai 模式已启用，并检测到 Cookie 配置${config.igneous ? ' (包含 igneous)' : ''}。`);
    } else {
      logger.warn('ExHentai 模式已启用，但未完整配置 Cookie。访问受限内容可能会失败。');
    }
  }

  const siteBase = `https://${config.site}`
  const apiBase = `https://api.e-hentai.org/api.php`

  function buildHeaders() {
    const cookieParts: string[] = [];
    if (config.ipb_member_id) cookieParts.push(`ipb_member_id=${config.ipb_member_id}`);
    if (config.ipb_pass_hash) cookieParts.push(`ipb_pass_hash=${config.ipb_pass_hash}`);
    if (config.igneous) cookieParts.push(`igneous=${config.igneous}`);
    
    return {
      'Cookie': cookieParts.join('; '),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    }
  }

  async function getGalleryMetadata(galleries: { gid: string, token: string }[]): Promise<any[]> {
    try {
      const payload = { method: 'gdata', gidlist: galleries.map(g => [g.gid, g.token]), namespace: 1 }
      const response = await ctx.http.post(apiBase, payload, { headers: buildHeaders() })
      let data = response;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) {
          logger.error('[API] 手动解析 JSON 失败', { rawResponse: data });
          return [];
        }
      }
      if (!data) { logger.warn('[API] 响应为空或无效'); return []; }
      if (config.debug) { logger.info('[API] 解析后的数据: %o', data); }
      if (data.error) { logger.warn(`[API] E-Hentai API 返回明确错误: ${data.error}`); return []; }
      return data.gmetadata || []
    } catch (error) {
      logger.error(`[API] 请求元数据时发生网络错误`, { error: error.response?.data || error.message });
      return [];
    }
  }

  async function searchGalleries(keyword: string): Promise<{ url: string, title: string, thumb: string, tags: string[] }[]> {
    const searchUrl = `${siteBase}/?f_search=${encodeURIComponent(keyword)}`
    if (config.debug) logger.info(`[搜索] 正在抓取搜索页面: ${searchUrl}`)
    try {
      const html = await ctx.http.get<string>(searchUrl, { headers: buildHeaders() })
      const $ = load(html)
      const results: { url: string, title: string, thumb: string, tags: string[] }[] = []
      $('table.gltc tbody tr').each((i, elem) => {
        const linkElement = $(elem).find('td.gl3c a')
        const imgElement = $(elem).find('td.gl2c img')
        const url = linkElement.attr('href')
        const title = linkElement.find('.glink').text()
        let thumb = imgElement.attr('data-src') || imgElement.attr('src')
        const tags: string[] = []
        $(elem).find('.gt, .gtl').each((_, tagElem) => {
          tags.push($(tagElem).attr('title'))
        })
        if (url && title) results.push({ url, title, thumb, tags })
      })
      return results.slice(0, config.searchResultCount);
    } catch (error) {
      logger.error(`[搜索] 抓取或解析搜索页面失败: ${keyword}`, { error });
      return [];
    }
  }
  
  async function scrapeWithRetry<T>(url: string, parser: (html: string) => T): Promise<T | null> {
    for (let i = 0; i <= config.downloadRetries; i++) {
      try {
        await sleep(config.scrapeDelay * 1000);
        const html = await ctx.http.get<string>(url, { headers: buildHeaders() });
        return parser(html);
      } catch (error) {
        if (i < config.downloadRetries) {
          if (config.debug) logger.warn(`[抓取] 页面 ${url} 失败 (第 ${i + 1} 次), 2秒后重试...`);
          await sleep(2000);
        } else {
          logger.error(`[抓取] 页面 ${url} 在重试 ${config.downloadRetries} 次后最终失败。`);
          return null;
        }
      }
    }
  }

  async function getImageUrlsFromGallery(gid: string, gtoken: string): Promise<string[]> {
      const gdata = await getGalleryMetadata([{ gid, token: gtoken }]);
      const [metadata] = gdata;
      if (!metadata) throw new Error('无法获取画廊元数据，请检查Cookie或站点配置。');
      
      const fileCount = parseInt(metadata.filecount, 10);
      const galleryUrl = `${siteBase}/g/${gid}/${gtoken}/`;
      const allImageUrls: string[] = new Array(fileCount).fill(null);
      
      logger.info(`[抓取] 画廊共有 ${fileCount} 张图片。开始抓取图片链接...`);
      
      const allDetailLinks: string[] = [];

      const firstPageUrl = `${galleryUrl}?p=0`;
      const firstPageLinks = await scrapeWithRetry(firstPageUrl, (html) => {
        const $ = load(html);
        if ($('#gdt').length === 0) {
          logger.error(`[抓取] 错误：页面 ${firstPageUrl} HTML内容中未找到画廊元素(#gdt)。`);
          return [];
        }
        const links: string[] = [];
        $('#gdt a').each((_, elem) => {
          const href = $(elem).attr('href');
          if(href && href.includes('/s/')) links.push(href);
        });
        return links;
      });

      if (!firstPageLinks || firstPageLinks.length === 0) {
        logger.error(`[抓取] 无法从第一页获取任何图片链接，任务中止。请检查网络或 Cookie。`);
        return [];
      }

      const thumbsPerPage = firstPageLinks.length;
      const pageCount = Math.ceil(fileCount / thumbsPerPage);
      logger.info(`[抓取] 动态检测到每页有 ${thumbsPerPage} 个缩略图。预计总页数: ${pageCount}。`);
      allDetailLinks.push(...firstPageLinks);
      
      if (pageCount > 1) {
        const remainingPagePromises = Array.from({ length: pageCount - 1 }, (_, i) => {
          const pageNum = i + 1;
          const pageUrl = `${galleryUrl}?p=${pageNum}`;
          return scrapeWithRetry(pageUrl, (html) => {
            const $ = load(html);
            const links: string[] = [];
            $('#gdt a').each((_, elem) => {
              const href = $(elem).attr('href');
              if (href && href.includes('/s/')) links.push(href);
            });
            if (config.debug) logger.info(`[抓取] 页面 ${pageNum + 1}/${pageCount} (${pageUrl}) 找到 ${links.length} 个详情链接。`);
            return links;
          });
        });
        const resultsOfRemainingPages = await Promise.all(remainingPagePromises);
        resultsOfRemainingPages.forEach(links => {
          if (links) allDetailLinks.push(...links);
        });
      }

      logger.info(`[抓取] 阶段一完成：共收集到 ${allDetailLinks.length} 个有效的图片详情页链接。`);

      const detailPagePromises = allDetailLinks.map(link => {
        return scrapeWithRetry(link, (html) => {
          const $$ = load(html);
          const imageUrl = $$('#img').attr('src');
          const linkIndexMatch = link.match(/-(\d+)$/);
          if (imageUrl && linkIndexMatch) {
            const index = parseInt(linkIndexMatch[1], 10) - 1;
            return { index, imageUrl };
          }
          logger.warn(`[抓取] 在 ${link} 未找到图片URL或索引。`);
          return null;
        });
      });

      const resultsOfDetails = await Promise.all(detailPagePromises);
      let foundCount = 0;
      for (const result of resultsOfDetails) {
        if (result && result.index < allImageUrls.length && !allImageUrls[result.index]) {
          allImageUrls[result.index] = result.imageUrl;
          foundCount++;
        }
      }
      
      logger.info(`[抓取] 阶段二完成：成功提取 ${foundCount}/${fileCount} 个最终图片链接。`);
      if (foundCount < fileCount) {
        logger.warn(`[抓取] 警告：发现漏页现象，应有 ${fileCount} 张，实际找到 ${foundCount} 张。请检查网络或目标画廊。`);
      }
      
      return allImageUrls.filter(url => !!url);
  }

  async function downloadImage(url: string, index: number, referer?: string): Promise<{ index: number; buffer: Buffer } | { index: number; error: Error }> {
    for (let i = 0; i <= config.downloadRetries; i++) {
      try {
        const headers = buildHeaders();
        if (referer) {
          headers['Referer'] = referer;
        }
        const arrayBuffer = await ctx.http.get(url, { 
          timeout: config.downloadTimeout * 1000, 
          responseType: 'arraybuffer', 
          headers: headers 
        });
        return { index, buffer: Buffer.from(arrayBuffer) };
      } catch (error) {
        if (i < config.downloadRetries) {
          if (config.debug) logger.warn(`[下载] 图片 ${index + 1} (${url}) 下载失败 (第 ${i + 1} 次), 2秒后重试...`);
          await sleep(2000);
        } else {
          logger.error(`[下载] 图片 ${index + 1} (${url}) 在重试 ${config.downloadRetries} 次后最终失败。`);
          return { index, error };
        }
      }
    }
  }

  ctx.command('ehsearch <keyword:text>', 'E-Hentai 漫画搜索')
    .action(async ({ session }, keyword) => {
      if (!keyword) return '请输入关键词。'
      const [statusMessageId] = await session.send(h('quote', { id: session.messageId }) + '正在搜索...');
      try {
        const results = await searchGalleries(keyword);
        if (results.length === 0) {
          await session.send('未找到任何结果。');
          return;
        }
        
        const useForward = config.useForwardForSearch && ['qq', 'onebot'].includes(session.platform);

        if (useForward) {
          // --- 合并转发逻辑 ---
          const forwardElements: h[] = [h('p', `搜索到 ${results.length} 个结果，为您展示前 ${Math.min(results.length, config.searchResultCount)} 个：`)];

          for (const [index, gallery] of results.entries()) {
            const textElements: h[] = [];
            const parsedTags = { parody: [], character: [], group: [], artist: [], male: [], female: [], misc: [] };
            for (const tag of gallery.tags) {
              const parts = tag.split(':');
              if (parts.length > 1) {
                const namespace = parts[0];
                const tagName = parts.slice(1).join(':');
                if (parsedTags[namespace]) parsedTags[namespace].push(tagName); else parsedTags.misc.push(tag);
              } else {
                parsedTags.misc.push(tag);
              }
            }
            let tagInfo = `[标题] ${gallery.title}\n`;
            if (parsedTags.parody.length > 0) tagInfo += `[原作] ${parsedTags.parody.join(', ')}\n`;
            if (parsedTags.artist.length > 0) tagInfo += `[作者] ${parsedTags.artist.join(', ')}\n`;
            if (parsedTags.group.length > 0) tagInfo += `[团体] ${parsedTags.group.join(', ')}\n`;
            if (parsedTags.character.length > 0) tagInfo += `[角色] ${parsedTags.character.join(', ')}\n`;
            const otherTags = [...parsedTags.female, ...parsedTags.male, ...parsedTags.misc];
            if (otherTags.length > 0) tagInfo += `[标签] ${otherTags.slice(0, 8).join(', ')}${otherTags.length > 8 ? '...' : ''}\n`;
            tagInfo += `[URL] ${gallery.url}`;
            
            textElements.push(h('p', '──────────'));
            textElements.push(h('p', tagInfo));

            const imageElement = (config.showImageInSearch && gallery.thumb) ? await (async () => {
              try {
                const result = await downloadImage(gallery.thumb, index, siteBase + '/');
                return ('buffer' in result) ? h.image(bufferToDataURI(result.buffer)) : null;
              } catch (e) {
                if (config.debug) logger.warn(`[搜索] 下载封面失败: ${gallery.thumb}`, e);
                return null;
              }
            })() : null;

            if (config.splitMessagesInSearch) {
              // 分离模式：文本和图片成为两个独立的转发节点
              forwardElements.push(h('message', textElements));
              if (imageElement) forwardElements.push(h('message', imageElement));
            } else {
              // 合并模式：文本和图片在同一个转发节点
              if (imageElement) textElements.push(imageElement);
              forwardElements.push(h('message', textElements));
            }
          }
          await session.send(h('figure', {}, forwardElements));

        } else {
          // --- 逐条发送逻辑 ---
          await session.send(`搜索到 ${results.length} 个结果，为您展示前 ${Math.min(results.length, config.searchResultCount)} 个：`);
          
          for (const [index, gallery] of results.entries()) {
            const textElements: h[] = [];
            const parsedTags = { parody: [], character: [], group: [], artist: [], male: [], female: [], misc: [] };
            for (const tag of gallery.tags) {
              const parts = tag.split(':');
              if (parts.length > 1) {
                const namespace = parts[0];
                const tagName = parts.slice(1).join(':');
                if (parsedTags[namespace]) parsedTags[namespace].push(tagName); else parsedTags.misc.push(tag);
              } else {
                parsedTags.misc.push(tag);
              }
            }
            let tagInfo = `[标题] ${gallery.title}\n`;
            if (parsedTags.parody.length > 0) tagInfo += `[原作] ${parsedTags.parody.join(', ')}\n`;
            if (parsedTags.artist.length > 0) tagInfo += `[作者] ${parsedTags.artist.join(', ')}\n`;
            if (parsedTags.group.length > 0) tagInfo += `[团体] ${parsedTags.group.join(', ')}\n`;
            if (parsedTags.character.length > 0) tagInfo += `[角色] ${parsedTags.character.join(', ')}\n`;
            const otherTags = [...parsedTags.female, ...parsedTags.male, ...parsedTags.misc];
            if (otherTags.length > 0) tagInfo += `[标签] ${otherTags.slice(0, 8).join(', ')}${otherTags.length > 8 ? '...' : ''}\n`;
            tagInfo += `[URL] ${gallery.url}`;
            
            textElements.push(h('p', '──────────'));
            textElements.push(h('p', tagInfo));

            const imageElement = (config.showImageInSearch && gallery.thumb) ? await (async () => {
              try {
                const result = await downloadImage(gallery.thumb, index, siteBase + '/');
                return ('buffer' in result) ? h.image(bufferToDataURI(result.buffer)) : null;
              } catch (e) {
                if (config.debug) logger.warn(`[搜索] 下载封面失败: ${gallery.thumb}`, e);
                return null;
              }
            })() : null;

            if (config.splitMessagesInSearch) {
              // 分离模式：先发文本，再发图片
              await session.send(textElements);
              await sleep(500);
              if (imageElement) await session.send(imageElement);
              await sleep(500);
            } else {
              // 合并模式：文本和图片一起发
              if (imageElement) textElements.push(imageElement);
              await session.send(textElements);
              await sleep(1000);
            }
          }
        }
      } catch (error) {
          logger.error(`[搜索] 命令执行失败。关键词: "${keyword}"`, { error })
          return '搜索失败，请查看后台日志。';
      } finally {
          try { await session.bot.deleteMessage(session.channelId, statusMessageId); } catch (e) {
              if (config.debug) logger.warn('撤回搜索状态消息失败', e);
          }
      }
    });

  ctx.command('ehdownload <url:string>', 'E-Hentai 漫画下载')
    .option('output', '-o <type:string>')
    .action(async ({ session, options }, url) => {
      if (!url) return '请输入画廊 URL。';
      const match = url.match(galleryUrlRegex);
      if (!match) return 'URL 格式不正确。请输入一个有效的 E-Hentai/ExHentai 画廊链接。';
      const [, , gid, gtoken] = match;
      const [statusMessageId] = await session.send(h('quote', { id: session.messageId }) + `收到请求，正在处理画廊 ${gid}...`);
      try {
        if (config.debug) logger.info(`[下载] 开始处理画廊 ${gid}/${gtoken}`);
        const allImageUrls = await getImageUrlsFromGallery(gid, gtoken);
        if (allImageUrls.length === 0) return '任务中止：未能从画廊页面中提取到任何图片链接，请检查后台日志以确认失败原因。';
        
        logger.info(`[下载] 链接抓取成功，共 ${allImageUrls.length} 张图片，准备下载...`);
        const reportFailures = async (failedIndexes: number[]) => {
          if (failedIndexes.length > 0) {
            const sortedIndexes = failedIndexes.map(i => i + 1).sort((a, b) => a - b);
            await session.send(`任务完成，但以下图片下载失败，已跳过：\n第 ${sortedIndexes.join(', ')} 张。`);
          }
        };
        const outputType = options.output || (config.defaultToPdf ? 'pdf' : 'image');
        if (outputType === 'pdf') {
          const [metadata] = await getGalleryMetadata([{ gid, token: gtoken }]);
          const galleryTitle = metadata?.title_jpn || metadata?.title || gid;
          let safeFilename = galleryTitle.replace(/[\\/:\*\?"<>\|]/g, '_');

          // 标题混淆功能
          if (config.enableTitleObfuscation) {
            safeFilename = safeFilename.split('').join(config.titleObfuscationChar);
          }
          const downloadDir = path.resolve(ctx.app.baseDir, config.downloadPath);
          const tempPdfPath = path.resolve(downloadDir, `${safeFilename}_${Date.now()}.pdf`);
          const finalPdfPath = path.resolve(downloadDir, `${safeFilename}.pdf`);
          const tempImageDir = path.resolve(downloadDir, `temp_${gid}_${Date.now()}`);
          await mkdir(tempImageDir, { recursive: true });
          let recipe: Recipe;
          const failedImageIndexes: number[] = [];
          try {
            recipe = new Recipe("new", tempPdfPath, { version: 1.6 });
            const successfulDownloads: { index: number; buffer: Buffer }[] = [];
            for (let i = 0; i < allImageUrls.length; i += config.downloadConcurrency) {
              const chunk = allImageUrls.slice(i, i + config.downloadConcurrency);
              if (config.debug) logger.info(`[下载] [PDF] 正在下载批次 ${Math.floor(i / config.downloadConcurrency) + 1}...`);
              const chunkPromises = chunk.map((url, idx) => downloadImage(url, i + idx));
              const chunkResults = await Promise.all(chunkPromises);
              for (const result of chunkResults) {
                if ('buffer' in result) successfulDownloads.push(result);
                else failedImageIndexes.push(result.index);
              }
            }
            successfulDownloads.sort((a,b) => a.index - b.index);
            for (const { index, buffer } of successfulDownloads) {
                if (config.debug) logger.info(`[下载] [PDF] 正在处理第 ${index + 1}/${allImageUrls.length} 张图片并添加到PDF...`);
                const imagePath = path.resolve(tempImageDir, `${index + 1}.jpg`);
                const sharpInstance = sharp(buffer);
                const jpegOptions: sharp.JpegOptions = {};
                if (config.enableCompression) { jpegOptions.quality = config.compressionQuality; }
                await sharpInstance.jpeg(jpegOptions).toFile(imagePath);
                const md = await sharp(imagePath).metadata();
                recipe.createPage(md.width, md.height).image(imagePath, 0, 0).endPage();
            }
            if (config.pdfPassword) recipe.encrypt({ userPassword: config.pdfPassword, ownerPassword: config.pdfPassword });
            recipe.endPDF();
            await rename(tempPdfPath, finalPdfPath);
            logger.info(`[下载] [PDF] 正在发送 PDF 文件: ${finalPdfPath}`);
            const fileAttributes = { filename: `${safeFilename}.pdf`, title: `${safeFilename}.pdf` };
            if (config.pdfSendMethod === 'buffer') {
              const pdfBuffer = await readFile(finalPdfPath);
              await session.send(h.file(pdfBuffer, 'application/pdf', fileAttributes));
            } else {
              await session.send(h.file(pathToFileURL(finalPdfPath).href, fileAttributes));
            }
          } finally {
            try { await unlink(finalPdfPath) } catch (e) {}
            try { await unlink(tempPdfPath) } catch (e) {}
            try { await rm(tempImageDir, { recursive: true, force: true }) } catch(e) {}
            await reportFailures(failedImageIndexes);
          }
        } else {
            if (config.useForwardForImages && ['qq', 'onebot'].includes(session.platform)) {
              const forwardElements: h[] = [];
              const failedImageIndexes: number[] = [];
              for (let i = 0; i < allImageUrls.length; i += config.downloadConcurrency) {
                const chunk = allImageUrls.slice(i, i + config.downloadConcurrency);
                const chunkPromises = chunk.map((url, idx) => downloadImage(url, i + idx));
                const chunkResults = await Promise.all(chunkPromises);
                for (const result of chunkResults) {
                  if ('buffer' in result) {
                    forwardElements.push(h.image(bufferToDataURI(result.buffer)));
                  } else {
                    failedImageIndexes.push(result.index);
                    forwardElements.push(h('p', `第 ${result.index + 1} 张图片下载失败`));
                  }
                }
              }
              if (forwardElements.length > 0) await session.send(h('figure', {}, forwardElements));
              else await session.send('所有图片都下载失败了，无法发送。');
            } else { 
              for (const [index, imageUrl] of allImageUrls.entries()) {
                try {
                  const result = await downloadImage(imageUrl, index);
                  if ('buffer' in result) {
                      await session.send([
                        h('p', `第 ${index + 1} / ${allImageUrls.length} 张`),
                        h.image(bufferToDataURI(result.buffer))
                      ]);
                  } else {
                      await session.send(`发送第 ${index + 1} 张图片失败(下载错误)，已跳过。`);
                  }
                } catch (error) {
                  logger.warn(`[下载] 发送单张图片失败。GID: ${gid}, 图片URL: ${imageUrl}`, { error });
                  await session.send(`发送第 ${index + 1} 张图片失败，已跳过。`);
                }
                await sleep(1500);
              }
            }
        }
      } catch (error) {
        logger.error(`[下载] 任务失败。GID: ${gid}`, { error: error.message, stack: error.stack });
        return h('quote', { id: session.messageId }) + `下载失败：${error.message}`;
      } finally {
        try { await session.bot.deleteMessage(session.channelId, statusMessageId); } catch (e) {
          if (config.debug) logger.warn('撤回初始状态消息失败', e);
        }
      }
    })
}