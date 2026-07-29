/* ==================== 视频文案提取引擎 ====================
 *  核心能力：
 *  1. YouTube 字幕 API 提取（通过 CORS 代理）
 *  2. B站 字幕 API 提取（通过 CORS 代理）
 *  3. 通用页面文案抓取（标题/描述/可见文字）
 *  4. Tesseract.js OCR 识别视频画面文字（用户上传视频文件）
 *  5. Web Speech API 语音转文字（Chrome/Edge 支持）
 *  6. 时间轴整理 + 导出（TXT/SRT/JSON）
 * ============================================================ */

const Extractor = {

  /* CORS 代理链（按优先级） */
  CORS_PROXIES: [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?url=',
    'https://cors.eu.org/',
  ],

  /* 平台链接匹配 */
  PLATFORM_LINKS: [
    { key: 'youtube',   name: 'YouTube',  icon: '▶',  patterns: [/youtube\.com\/watch\?v=([\w-]+)/i, /youtu\.be\/([\w-]+)/i], extractId: (m) => m[1] },
    { key: 'bilibili',  name: 'B站',      icon: '📺',  patterns: [/bilibili\.com\/video\/(BV[\w]+)/i, /b23\.tv\/([\w]+)/i], extractId: (m) => m[1] },
    { key: 'douyin',    name: '抖音',     icon: '🎵',  patterns: [/douyin\.com\/video\/(\d+)/i, /v\.douyin\.com\/([\w]+)/i], extractId: (m) => m[1] },
    { key: 'kuaishou',  name: '快手',     icon: '⚡',  patterns: [/kuaishou\.com\/short-video\/([\w]+)/i, /v\.kuaishou\.com\/([\w]+)/i], extractId: (m) => m[1] },
    { key: 'xhs',       name: '小红书',   icon: '📕',  patterns: [/xiaohongshu\.com\/explore\/([\w]+)/i, /xhslink\.com\/([\w]+)/i], extractId: (m) => m[1] },
    { key: 'wechat',    name: '视频号',   icon: '💬',  patterns: [/channels\.weixin\.qq\.com/i, /video\.weixin\.qq\.com/i], extractId: (m) => null },
    { key: 'toutiao',   name: '头条',     icon: '📰',  patterns: [/toutiao\.com\/video\/([\w]+)/i, /toutiao\.com\/w\/([\w]+)/i], extractId: (m) => m[1] },
  ],

  /* OCR 配置 */
  OCR_INTERVAL: 2,        // 每2秒提取一帧
  OCR_LANGUAGES: 'chi_sim+eng',
  TESSERACT_CDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',

  /* ================================================================
   *  主入口：从链接提取
   * ================================================================ */
  async extractFromLink(url) {
    const platform = this.detectPlatformFromUrl(url);
    if (!platform) {
      return { error: '无法识别链接平台，请粘贴有效的视频链接' };
    }

    const result = {
      platform,
      url,
      segments: [],
      title: '',
      description: '',
      source: '',
      methods: [],
    };

    // 按平台尝试不同提取策略
    try {
      if (platform.key === 'youtube') {
        const yt = await this.extractYouTube(platform.id);
        if (yt.segments.length > 0) {
          result.segments = yt.segments;
          result.title = yt.title;
          result.source = 'YouTube 字幕 API';
          result.methods.push('youtube_subtitle');
        }
      } else if (platform.key === 'bilibili') {
        const bili = await this.extractBilibili(platform.id);
        if (bili.segments.length > 0) {
          result.segments = bili.segments;
          result.title = bili.title;
          result.source = 'B站 字幕 API';
          result.methods.push('bilibili_subtitle');
        }
      }
    } catch (e) {
      result.methods.push('subtitle_api_failed: ' + e.message);
    }

    // 如果字幕 API 没有提取到，尝试页面抓取
    if (result.segments.length === 0) {
      try {
        const page = await this.extractFromPage(url);
        result.title = page.title || result.title;
        result.description = page.description || '';
        if (page.text) {
          result.segments.push({
            start: 0,
            end: 0,
            text: page.text,
            source: 'page_content',
            confidence: 'medium',
          });
          result.source = result.source || '页面内容抓取';
          result.methods.push('page_scrape');
        }
      } catch (e) {
        result.methods.push('page_scrape_failed: ' + e.message);
      }
    }

    // 最终整理
    if (result.segments.length > 0) {
      result.segments = this.organizeTimeline(result.segments);
    }

    return result;
  },

  /* ================================================================
   *  平台识别
   * ================================================================ */
  detectPlatformFromUrl(url) {
    for (const p of this.PLATFORM_LINKS) {
      for (const pattern of p.patterns) {
        const match = url.match(pattern);
        if (match) {
          return { ...p, id: p.extractId(match), matched: true };
        }
      }
    }
    return null;
  },

  /* ================================================================
   *  CORS 代理请求
   * ================================================================ */
  async fetchWithProxy(targetUrl, options = {}) {
    let lastError = null;
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(targetUrl);
        const response = await fetch(proxyUrl, {
          method: options.method || 'GET',
          headers: { 'Accept': 'text/html,application/json,application/xml,*/*' },
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          return await response.text();
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('所有代理均失败');
  },

  async fetchJSONWithProxy(targetUrl) {
    let lastError = null;
    for (const proxy of this.CORS_PROXIES) {
      try {
        const proxyUrl = proxy + encodeURIComponent(targetUrl);
        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          return await response.json();
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('所有代理均失败');
  },

  /* ================================================================
   *  YouTube 字幕提取
   * ================================================================ */
  async extractYouTube(videoId) {
    const result = { segments: [], title: '' };

    // 1. 获取视频页面，提取字幕 track URL
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await this.fetchWithProxy(watchUrl);

    // 提取标题
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      result.title = titleMatch[1].replace(' - YouTube', '').trim();
    }

    // 提取 captionTracks
    const captionMatch = html.match(/"captionTracks":(\[.*?\])/) || html.match(/captionTracks["\s:]+(\[.*?\])/);
    if (!captionMatch) return result;
    let tracks;
    try { tracks = JSON.parse(captionMatch[1]); } catch { return result; }

    if (!tracks || tracks.length === 0) return result;

    // 优先选择中文字幕，其次英文，最后第一个
    let track = tracks.find(t => t.languageCode && t.languageCode.startsWith('zh'))
      || tracks.find(t => t.languageCode && t.languageCode.startsWith('en'))
      || tracks[0];

    if (!track || !track.baseUrl) return result;

    // 2. 获取字幕内容（XML 格式）
    const subtitleUrl = track.baseUrl + '&fmt=json3';
    try {
      const subtitleData = await this.fetchJSONWithProxy(subtitleUrl);
      if (subtitleData && subtitleData.events) {
        for (const event of subtitleData.events) {
          if (!event.segs) continue;
          const text = event.segs.map(s => s.utf8 || '').join('').trim();
          if (text && text.length > 0) {
            result.segments.push({
              start: (event.tStartMs || 0) / 1000,
              end: ((event.tStartMs || 0) + (event.dDurationMs || 2000)) / 1000,
              text: text,
              source: 'youtube_subtitle',
              confidence: 'high',
            });
          }
        }
      }
    } catch (e) {
      // JSON 格式失败，尝试 XML 格式
      const xmlUrl = track.baseUrl + '&fmt=srv3';
      try {
        const xml = await this.fetchWithProxy(xmlUrl);
        const parsed = this.parseTTML(xml);
        result.segments = parsed;
      } catch (e2) {
        // 最后尝试原始格式
        const rawXml = await this.fetchWithProxy(track.baseUrl);
        const parsed = this.parseYouTubeXML(rawXml);
        result.segments = parsed;
      }
    }

    return result;
  },

  /* 解析 YouTube XML 字幕 */
  parseYouTubeXML(xml) {
    const segments = [];
    const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const dur = parseFloat(match[2]);
      let text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, '')
        .trim();
      if (text) {
        segments.push({
          start,
          end: start + dur,
          text,
          source: 'youtube_subtitle',
          confidence: 'high',
        });
      }
    }
    return segments;
  },

  /* 解析 TTML 字幕 */
  parseTTML(xml) {
    const segments = [];
    const regex = /<p begin="([^"]+)" end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const start = this.parseTimecode(match[1]);
      const end = this.parseTimecode(match[2]);
      const text = match[3].replace(/<[^>]+>/g, '').trim();
      if (text) {
        segments.push({ start, end, text, source: 'youtube_subtitle', confidence: 'high' });
      }
    }
    return segments;
  },

  parseTimecode(tc) {
    // PT0H0M1.500S or 00:00:01.500
    if (tc.startsWith('PT')) {
      const m = tc.match(/PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/);
      if (m) return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseFloat(m[3] || 0);
    }
    const parts = tc.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(tc) || 0;
  },

  /* ================================================================
   *  B站 字幕提取
   * ================================================================ */
  async extractBilibili(bvId) {
    const result = { segments: [], title: '' };

    // 1. 获取视频信息（cid + subtitle info）
    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`;
    const videoInfo = await this.fetchJSONWithProxy(apiUrl);

    if (!videoInfo || videoInfo.code !== 0 || !videoInfo.data) {
      return result;
    }

    result.title = videoInfo.data.title || '';
    const cid = videoInfo.data.cid;
    const aid = videoInfo.data.aid;

    if (!cid) return result;

    // 2. 获取字幕列表
    const playerUrl = `https://api.bilibili.com/x/player/v2?cid=${cid}&aid=${aid}&bvid=${bvId}`;
    const playerInfo = await this.fetchJSONWithProxy(playerUrl);

    if (!playerInfo || playerInfo.code !== 0 || !playerInfo.data) {
      return result;
    }

    const subtitles = playerInfo.data.subtitle?.subtitles || [];
    if (subtitles.length === 0) return result;

    // 优先中文 AI 字幕
    let sub = subtitles.find(s => s.lan && s.lan.startsWith('zh'))
      || subtitles[0];

    if (!sub || !sub.subtitle_url) return result;

    // 3. 获取字幕内容
    let subUrl = sub.subtitle_url;
    if (subUrl.startsWith('//')) subUrl = 'https:' + subUrl;
    if (!subUrl.startsWith('http')) subUrl = 'https://' + subUrl;

    const subData = await this.fetchJSONWithProxy(subUrl);

    if (subData && subData.body) {
      for (const item of subData.body) {
        if (item.content && item.content.trim()) {
          result.segments.push({
            start: item.from || 0,
            end: item.to || (item.from || 0) + 3,
            text: item.content.trim(),
            source: 'bilibili_subtitle',
            confidence: 'high',
          });
        }
      }
    }

    return result;
  },

  /* ================================================================
   *  通用页面文案抓取
   * ================================================================ */
  async extractFromPage(url) {
    const result = { title: '', description: '', text: '' };

    const html = await this.fetchWithProxy(url);

    // 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 提取标题
    result.title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      doc.querySelector('title')?.textContent ||
      doc.querySelector('meta[name="title"]')?.getAttribute('content') ||
      '';
    result.title = result.title.trim();

    // 提取描述
    result.description =
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    // 提取页面可见文本（去除脚本和样式）
    const scripts = doc.querySelectorAll('script, style, noscript');
    scripts.forEach(s => s.remove());

    // 尝试提取视频描述区域的文本
    const bodyText = doc.body?.textContent || '';
    const cleanText = bodyText
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 如果有描述就用描述，否则用页面文本的前500字
    if (result.description && result.description.length > 20) {
      result.text = result.description;
    } else if (cleanText.length > 50) {
      result.text = cleanText.substring(0, 1000);
    }

    // 尝试提取 JSON-LD 数据中的文案
    const jsonLd = doc.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data.description) {
          result.description = data.description;
          result.text = result.text || data.description;
        }
        if (data.name && !result.title) {
          result.title = data.name;
        }
      } catch {}
    }

    // 尝试从页面脚本中提取字幕/文案数据
    const scriptTexts = doc.querySelectorAll('script');
    for (const script of scriptTexts) {
      const content = script.textContent || '';
      // 抖音：尝试找 video desc
      if (content.includes('"desc"') && content.length < 50000) {
        const descMatch = content.match(/"desc"\s*:\s*"([^"]{10,})"/);
        if (descMatch && !result.text) {
          result.text = descMatch[1];
          result.description = descMatch[1];
        }
      }
      // 通用：找 subtitle / caption / transcript
      if (content.includes('subtitle') || content.includes('caption') || content.includes('transcript')) {
        const subMatch = content.match(/"subtitle"\s*:\s*"([^"]{10,})"/);
        if (subMatch && !result.text) {
          result.text = subMatch[1];
        }
      }
    }

    return result;
  },

  /* ================================================================
   *  视频文件 OCR 提取（Tesseract.js）
   * ================================================================ */
  async extractFromVideoFile(file, onProgress) {
    const result = { segments: [], title: file.name, source: 'OCR + 语音识别', methods: [] };

    // 1. 创建视频元素并加载
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('视频加载超时')), 30000);
    });

    const duration = video.duration;
    result.duration = duration;

    // 2. 加载 Tesseract.js
    if (typeof Tesseract === 'undefined') {
      await this.loadTesseract();
    }

    // 3. OCR 提取画面文字
    if (onProgress) onProgress(0, '正在初始化 OCR 引擎...', 'ocr');
    const worker = await Tesseract.createWorker(this.OCR_LANGUAGES, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100), `OCR 识别中... ${Math.round(m.progress * 100)}%`, 'ocr');
        }
      },
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 360;

    const interval = this.OCR_INTERVAL;
    const totalFrames = Math.floor(duration / interval);
    let ocrSegments = [];

    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      if (onProgress) {
        onProgress(Math.round((i / totalFrames) * 100), `提取画面文字... ${i + 1}/${totalFrames}`, 'ocr');
      }

      // seek 到目标时间
      await this.seekTo(video, time);

      // 绘制到 canvas
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      canvas.width = Math.min(vw, 640);
      canvas.height = Math.min(vh, 360);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // OCR 识别
      try {
        const { data } = await worker.recognize(canvas);
        const text = data.text.trim();
        if (text && text.length > 1) {
          // 清理 OCR 结果
          const cleanText = text
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+|\s+$/g, '')
            .trim();
          if (cleanText.length > 2) {
            ocrSegments.push({
              start: time,
              end: time + interval,
              text: cleanText,
              source: 'ocr',
              confidence: data.confidence > 80 ? 'high' : data.confidence > 60 ? 'medium' : 'low',
              ocrConfidence: Math.round(data.confidence || 0),
            });
          }
        }
      } catch (e) {
        // 单帧 OCR 失败，继续下一帧
      }
    }

    await worker.terminate();
    result.segments.push(...ocrSegments);
    if (ocrSegments.length > 0) result.methods.push('ocr');

    // 4. 语音转文字（Web Speech API）
    if (onProgress) onProgress(0, '正在提取语音内容...', 'speech');

    try {
      const speechSegments = await this.extractSpeechFromVideo(video, duration, onProgress);
      if (speechSegments.length > 0) {
        result.segments.push(...speechSegments);
        result.methods.push('speech');
      }
    } catch (e) {
      result.methods.push('speech_failed: ' + e.message);
    }

    // 5. 清理
    URL.revokeObjectURL(videoUrl);
    video.remove();

    // 6. 整理时间轴
    result.segments = this.organizeTimeline(result.segments);

    return result;
  },

  /* 加载 Tesseract.js */
  loadTesseract() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.TESSERACT_CDN;
      script.onload = () => {
        if (typeof Tesseract !== 'undefined') resolve();
        else reject(new Error('Tesseract.js 加载失败'));
      };
      script.onerror = () => reject(new Error('Tesseract.js CDN 加载失败'));
      document.head.appendChild(script);
    });
  },

  /* seek 到指定时间 */
  seekTo(video, time) {
    return new Promise((resolve) => {
      const handler = () => {
        video.removeEventListener('seeked', handler);
        resolve();
      };
      video.addEventListener('seeked', handler, { once: true });
      video.currentTime = time;
      setTimeout(() => {
        video.removeEventListener('seeked', handler);
        resolve();
      }, 3000);
    });
  },

  /* ================================================================
   *  Web Speech API 语音转文字
   *  注意：此功能在 Chrome/Edge 中可用，Safari/Firefox 不支持
   * ================================================================ */
  async extractSpeechFromVideo(video, duration, onProgress) {
    const segments = [];

    // 检查浏览器支持
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('当前浏览器不支持语音识别，请使用 Chrome 或 Edge');
    }

    // Web Speech API 只能识别实时音频，无法直接处理视频文件
    // 我们通过播放视频并实时识别来实现
    return new Promise((resolve) => {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;

      let currentSegment = { start: 0, text: '' };
      let isPlaying = false;
      let startTime = Date.now();

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText) {
          const elapsed = (Date.now() - startTime) / 1000;
          segments.push({
            start: Math.max(0, elapsed - 3),
            end: elapsed,
            text: finalText.trim(),
            source: 'speech',
            confidence: 'medium',
          });
        }
      };

      recognition.onerror = (event) => {
        resolve(segments);
      };

      recognition.onend = () => {
        resolve(segments);
      };

      // 播放视频并开始识别
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1;

      video.play().then(() => {
        isPlaying = true;
        startTime = Date.now();
        recognition.start();
        if (onProgress) onProgress(0, '正在识别语音内容...', 'speech');
      }).catch(() => {
        // 无法播放音频，跳过语音识别
        resolve(segments);
      });

      // 视频结束时停止
      video.addEventListener('ended', () => {
        if (isPlaying) {
          recognition.stop();
          isPlaying = false;
        }
      }, { once: true });

      // 最多识别5分钟（避免长时间运行）
      setTimeout(() => {
        if (isPlaying) {
          recognition.stop();
          video.pause();
          isPlaying = false;
        }
      }, 300000);
    });
  },

  /* ================================================================
   *  时间轴整理
   * ================================================================ */
  organizeTimeline(segments) {
    if (!segments || segments.length === 0) return [];

    // 1. 按开始时间排序
    const sorted = [...segments].sort((a, b) => a.start - b.start);

    // 2. 合并相邻重复内容
    const merged = [];
    for (const seg of sorted) {
      const last = merged[merged.length - 1];
      if (last && seg.start - last.end < 0.5 && seg.text === last.text) {
        // 合并
        last.end = Math.max(last.end, seg.end);
      } else if (last && seg.text && last.text && this.similarity(seg.text, last.text) > 0.85) {
        // 高相似度，跳过
        continue;
      } else {
        merged.push({ ...seg });
      }
    }

    // 3. 补充缺失的时间戳
    for (let i = 0; i < merged.length; i++) {
      if (!merged[i].end || merged[i].end <= merged[i].start) {
        const next = merged[i + 1];
        merged[i].end = next ? next.start : merged[i].start + 5;
      }
    }

    return merged;
  },

  /* 文本相似度计算 */
  similarity(a, b) {
    if (!a || !b) return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    const editDist = this.editDistance(shorter, longer);
    return (longer.length - editDist) / longer.length;
  },

  editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) { costs[j] = j; }
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  },

  /* ================================================================
   *  导出功能
   * ================================================================ */

  /* 格式化时间码 */
  formatTimecode(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  },

  formatTimecodeShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  /* 导出为 TXT */
  exportToTXT(segments, title) {
    let text = `${title || '视频文案提取结果'}\n`;
    text += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
    text += `共 ${segments.length} 段\n`;
    text += `${'='.repeat(50)}\n\n`;

    for (const seg of segments) {
      const time = this.formatTimecodeShort(seg.start);
      const sourceIcon = this.getSourceIcon(seg.source);
      text += `[${time}] ${sourceIcon} ${seg.text}\n\n`;
    }

    return text;
  },

  /* 导出为 SRT */
  exportToSRT(segments) {
    let srt = '';
    segments.forEach((seg, i) => {
      srt += `${i + 1}\n`;
      srt += `${this.formatTimecode(seg.start)} --> ${this.formatTimecode(seg.end)}\n`;
      srt += `${seg.text}\n\n`;
    });
    return srt;
  },

  /* 导出为 JSON */
  exportToJSON(segments, meta = {}) {
    return JSON.stringify({
      ...meta,
      exportTime: new Date().toISOString(),
      segmentCount: segments.length,
      segments,
    }, null, 2);
  },

  /* 下载文件 */
  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /* 获取来源图标 */
  getSourceIcon(source) {
    const icons = {
      youtube_subtitle: '🎬',
      bilibili_subtitle: '🎬',
      ocr: '📷',
      speech: '🎙',
      page_content: '📄',
      manual: '✏',
    };
    return icons[source] || '📝';
  },

  /* 获取来源名称 */
  getSourceName(source) {
    const names = {
      youtube_subtitle: 'YouTube字幕',
      bilibili_subtitle: 'B站字幕',
      ocr: '画面OCR',
      speech: '语音识别',
      page_content: '页面文案',
      manual: '手动输入',
    };
    return names[source] || '提取';
  },

  /* 合并所有文案为一段纯文本 */
  mergeToPlainText(segments) {
    return segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  },
};
