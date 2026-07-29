/* ==================== 爆款视频分析引擎 ====================
 *  核心能力：
 *  1. 平台自动识别（URL/文本模式匹配）
 *  2. 文案分句 + 爆点提取（6类爆点）
 *  3. 每个爆点深度分析（有效性原理 + 可复用模板）
 *  4. 三维评分系统（爆点强度/可复制性/平台适配度）
 *  5. 全文节奏与结构诊断
 * ============================================================ */

const Analyzer = {

  /* ====== 平台识别规则 ====== */
  PLATFORM_PATTERNS: [
    { key: 'douyin',   name: '抖音',   icon: '🎵', patterns: [/douyin\.com/i, /iesdouyin\.com/i, /v\.douyin\.com/i, /dy\.com/i], searchUrl: 'https://www.douyin.com/search/' },
    { key: 'kuaishou', name: '快手',   icon: '⚡', patterns: [/kuaishou\.com/i, /gifshow\.com/i, /chenzhongtech\.com/i, /kwai\.com/i], searchUrl: 'https://www.kuaishou.com/search/video?searchKey=' },
    { key: 'xhs',      name: '小红书', icon: '📕', patterns: [/xiaohongshu\.com/i, /xhslink\.com/i, /xhs\.cn/i], searchUrl: 'https://www.xiaohongshu.com/search_result?keyword=' },
    { key: 'bilibili', name: 'B站',   icon: '📺', patterns: [/bilibili\.com/i, /b23\.tv/i, /bilivideo/i], searchUrl: 'https://search.bilibili.com/all?keyword=' },
    { key: 'wechat',   name: '视频号', icon: '💬', patterns: [/channels\.weixin/i, /video\.weixin/i], searchUrl: 'https://channels.weixin.qq.com/search?q=' },
    { key: 'youtube',  name: 'YouTube',icon: '▶', patterns: [/youtube\.com/i, /youtu\.be/i], searchUrl: 'https://www.youtube.com/results?search_query=' },
    { key: 'tiktok',   name: 'TikTok', icon: '🎼', patterns: [/tiktok\.com/i, /vm\.tiktok/i], searchUrl: 'https://www.tiktok.com/search?q=' },
  ],

  /* ====== 爆点类型定义 ====== */
  VIRAL_TYPES: [
    {
      id: 'hook', name: '标题钩子', icon: '🎯', color: '#ff6b6b',
      desc: '3秒内抓住注意力的开场设计',
      principles: ['好奇心缺口', '痛点刺激', '反差制造', '数字冲击']
    },
    {
      id: 'twist', name: '情绪转折', icon: '⚡', color: '#feca57',
      desc: '打破预期、制造意外的情绪翻转点',
      principles: ['认知失调', '情绪过山车', '反差制造', '叙事张力']
    },
    {
      id: 'golden', name: '金句提炼', icon: '✨', color: '#48dbfb',
      desc: '具有传播力、可被截图转发的精炼表达',
      principles: ['认知封装', '情绪共鸣', '社交货币', '价值浓缩']
    },
    {
      id: 'conflict', name: '冲突点', icon: '🔥', color: '#ee5a6f',
      desc: '制造对立、引发讨论的争议性内容',
      principles: ['认知冲突', '价值观对立', '身份认同', '从众心理']
    },
    {
      id: 'suspense', name: '悬念设置', icon: '🎬', color: '#a29bfe',
      desc: '延迟满足、制造信息缺口留住用户',
      principles: ['好奇心缺口', '蔡格尼克效应', '预期管理', '信息差利用']
    },
    {
      id: 'interact', name: '互动引导', icon: '💬', color: '#00d2d3',
      desc: '引导用户评论、点赞、收藏的行为指令',
      principles: ['行为指令', '社交认同', '互惠心理', '参与感制造']
    },
  ],

  /* ====== 平台特性权重 ====== */
  PLATFORM_TRAITS: {
    douyin:    { fastHook: 0.30, emotionalTurn: 0.25, conflict: 0.20, interact: 0.15, suspense: 0.05, golden: 0.05, avgDuration: 60,  completeRateWeight: 0.35 },
    kuaishou:  { fastHook: 0.25, emotionalTurn: 0.30, conflict: 0.15, interact: 0.15, suspense: 0.05, golden: 0.10, avgDuration: 50,  completeRateWeight: 0.30 },
    xhs:       { fastHook: 0.20, emotionalTurn: 0.20, conflict: 0.10, interact: 0.20, suspense: 0.10, golden: 0.20, avgDuration: 90,  completeRateWeight: 0.20 },
    bilibili:  { fastHook: 0.15, emotionalTurn: 0.20, conflict: 0.15, interact: 0.10, suspense: 0.15, golden: 0.25, avgDuration: 180, completeRateWeight: 0.15 },
    wechat:    { fastHook: 0.15, emotionalTurn: 0.25, conflict: 0.10, interact: 0.10, suspense: 0.10, golden: 0.30, avgDuration: 120, completeRateWeight: 0.15 },
    youtube:   { fastHook: 0.20, emotionalTurn: 0.20, conflict: 0.15, interact: 0.10, suspense: 0.15, golden: 0.20, avgDuration: 300, completeRateWeight: 0.15 },
  },

  /* ====== 爆点检测模式库 ====== */
  DETECTION_PATTERNS: {
    hook: {
      // 数字钩子: "3个方法", "99%的人"
      numberHook: /\d+[个条种步招]\S{0,8}([，。！]?|$)/g,
      // 疑问钩子: "为什么...?", "你知道吗?"
      questionHook: /^(为什么|你知道吗|你有没有|想不想知道|猜猜|你信吗|敢不敢)/g,
      // 否定反转: "别再...", "不要再..."
      negationHook: /^(别再|不要再|千万别|不要|停止)/g,
      // 震惊式: "震惊!", "万万没想到"
      shockHook: /(震惊|万万没想到|离谱|炸裂|破防|谁敢信|疯了吧)/g,
      // 对比式: "月薪3千 vs 月薪3万"
      contrastHook: /(vs|VS|对比|同样是|凭什么.*别人)/g,
      // 痛点式: "你是不是也..."
      painHook: /(你是不是|你还在.*吗|别告诉我你也|中了|你中了几条)/g,
      // 第一人称故事: "那天我...", "前几天..."
      storyHook: /^(那天|前几天|上周|去年|刚才|有一次|说起)/g,
      // 指令式: "给我30秒", "先别划走"
      commandHook: /(给我\d+秒|先别划走|别急|等一下|看完|别划走)/g,
    },
    twist: {
      // 转折词
      turnWords: /(但是[！!]?|可是[！!]?|然而[——]?|结果[呢你]?|没想到[，,]?|万万没想到|谁知道|偏[偏]?[——]?|结果你猜)/g,
      // 真相揭示
      truthReveal: /(真相是|其实[吧呢]?|说白了|说到底|归根结底|实际上|事实上|说白了)/g,
      // 反转标记
      reversal: /(没想到|不料|谁知|哪知道|谁料|结果竟然|居然|竟然)/g,
    },
    golden: {
      // 排比句 (三个以上相同结构)
      parallelism: /(\S{4,12})[，,]\s*\S{0,4}?\1[，,]\s*\S{0,4}?\1/g,
      // 对仗句
      antithesis: /(不是?\S{3,10}[，,而]是?\S{3,10})/g,
      // 短句金句 (10-20字，含哲理)
      aphorism: /([\u4e00-\u9fa5]{8,20}[。！])/g,
      // 条件句式
      conditional: /(只要\S{3,10}就\S{3,10})/g,
    },
    conflict: {
      // 对立词
      opposition: /(vs|VS|但是.*而.*却|反而|偏偏|凭什么|为什么不|凭什么.*可以)/g,
      // 负面情绪
      negative: /(失败|放弃|被拒|嘲笑|看不起|白眼|讽刺|批评|质疑|吐槽|翻车|踩坑|交智商税)/g,
      // 对比描述
      contrast: /(别人.*你却|有人.*有人|前者.*后者|成功.*失败|穷人.*富人)/g,
      // 反共识
      antiConsensus: /(你以为.*其实|别信|错了|不对|才不是|恰恰相反|反过来才)/g,
    },
    suspense: {
      // 悬念词
      suspenseWords: /(接下来|后面|最后|结果|等一下|别急|看到最后|重点来了|关键在|到底|究竟)/g,
      // 设问
      questions: /(你猜|猜猜|你知道吗|想知道吗|要不要|如何|怎么做到的)/g,
      // 延迟揭示
      delayReveal: /(这个.*后面说|先卖个关子|留个悬念|后面揭晓|答案在)/g,
    },
    interact: {
      // 互动指令
      cta: /(评论区|扣\d|扣个|留言|告诉我|你怎么看|你觉得呢|你们说)/g,
      // 行为引导
      action: /(点赞|收藏|转发|关注|分享|艾特|@|一键三连|双击|长按)/g,
      // 参与式
      participatory: /(你中了几条|你属于哪种|你呢|你也一样吗|有没有同感|同意的)/g,
    },
  },

  /* ================================================================
   *  主分析入口
   * ================================================================ */
  analyze(input) {
    const trimmed = (input || '').trim();
    if (trimmed.length < 15) {
      return { error: '内容太短，请输入完整的视频文案（至少15字）' };
    }

    // 1. 识别平台
    const platform = this.detectPlatform(trimmed);

    // 2. 清理文本，提取纯文案
    const { text, urls } = this.extractText(trimmed);

    // 3. 分句
    const sentences = this.splitSentences(text);
    if (sentences.length < 2) {
      return { error: '文案句子太少，无法有效分析。请输入完整的视频文案' };
    }

    // 4. 逐句检测爆点
    const viralPoints = this.extractViralPoints(sentences);

    // 5. 深度分析每个爆点
    const analyzedPoints = viralPoints.map(p => this.analyzePoint(p, sentences, platform));

    // 6. 结构与节奏分析
    const structure = this.analyzeStructure(sentences);
    const rhythm = this.analyzeRhythm(sentences);

    // 7. 三维评分
    const scores = this.calculateScores(analyzedPoints, sentences, platform, rhythm);

    // 8. 优化建议
    const suggestions = this.generateSuggestions(analyzedPoints, scores, platform, structure);

    // 9. 生成报告
    const report = this.buildReport(analyzedPoints, scores, suggestions, platform, structure, rhythm);

    return {
      platform,
      text,
      urls,
      sentenceCount: sentences.length,
      wordCount: text.length,
      viralPoints: analyzedPoints,
      structure,
      rhythm,
      scores,
      suggestions,
      report,
    };
  },

  /* ================================================================
   *  平台识别
   * ================================================================ */
  detectPlatform(text) {
    for (const p of this.PLATFORM_PATTERNS) {
      for (const pattern of p.patterns) {
        if (pattern.test(text)) {
          return { ...p, matched: true };
        }
      }
    }
    // 无URL时尝试文本特征推断
    const textHint = this.guessPlatformByText(text);
    return { ...this.PLATFORM_PATTERNS[0], name: textHint.name, icon: textHint.icon, key: textHint.key, matched: false, guessed: true };
  },

  guessPlatformByText(text) {
    if (/(老铁|家人们|双击|没毛病)/.test(text)) return { name: '快手', icon: '⚡', key: 'kuaishou' };
    if (/(姐妹|集美|绝绝子|种草|避雷|谁懂啊)/.test(text)) return { name: '小红书', icon: '📕', key: 'xhs' };
    if (/(观众老爷|UP主|投币|弹幕|三连)/.test(text)) return { name: 'B站', icon: '📺', key: 'bilibili' };
    if (/(朋友们|说句心里话|文章|公众号)/.test(text)) return { name: '视频号', icon: '💬', key: 'wechat' };
    return { name: '抖音', icon: '🎵', key: 'douyin' }; // 默认
  },

  /* ================================================================
   *  文本清理
   * ================================================================ */
  extractText(input) {
    // 提取URL
    const urlRegex = /https?:\/\/[^\s，。！？\n]+/g;
    const urls = (input.match(urlRegex) || []);
    // 去掉URL，保留文案
    let text = input.replace(urlRegex, '').trim();
    // 去掉多余的空白
    text = text.replace(/\s+/g, ' ').trim();
    return { text, urls };
  },

  /* ================================================================
   *  分句
   * ================================================================ */
  splitSentences(text) {
    // 按中文标点和换行分句
    const raw = text.split(/([。！？；…\n])/);
    const sentences = [];
    let current = '';
    for (let i = 0; i < raw.length; i++) {
      if (i % 2 === 0) {
        current = raw[i].trim();
      } else {
        current += raw[i];
        if (current.trim().length > 1) {
          sentences.push({ text: current.trim(), index: sentences.length, position: sentences.length });
        }
        current = '';
      }
    }
    if (current.trim().length > 1) {
      sentences.push({ text: current.trim(), index: sentences.length, position: sentences.length });
    }
    return sentences;
  },

  /* ================================================================
   *  爆点提取 —— 遍历每句，检测6类爆点
   * ================================================================ */
  extractViralPoints(sentences) {
    const points = [];
    let pointId = 0;

    sentences.forEach((sentence, sIdx) => {
      const text = sentence.text;
      const positionPct = Math.round((sIdx / Math.max(sentences.length - 1, 1)) * 100);

      // 估算触发时机（假设60秒视频）
      const estimatedTime = Math.round(positionPct / 100 * 60);

      // 检测各类爆点
      const types = ['hook', 'twist', 'golden', 'conflict', 'suspense', 'interact'];

      types.forEach(type => {
        const patterns = this.DETECTION_PATTERNS[type];
        const matches = [];

        for (const [patternName, regex] of Object.entries(patterns)) {
          const found = text.match(regex);
          if (found && found.length > 0) {
            found.forEach(m => {
              matches.push({
                pattern: patternName,
                matchedText: m.substring(0, 50),
                regex: regex.source
              });
            });
          }
        }

        if (matches.length > 0) {
          const viralType = this.VIRAL_TYPES.find(v => v.id === type);
          points.push({
            id: 'vp' + (pointId++),
            type: viralType,
            sentenceIndex: sIdx,
            positionPct,
            estimatedTime,
            content: text,
            matches: matches.slice(0, 3),
            intensity: this.calculateIntensity(type, matches, text),
          });
        }
      });
    });

    // 对同句中同类爆点去重（保留强度最高的）
    const deduped = [];
    const seen = {};
    points.forEach(p => {
      const key = p.type.id + '_' + p.sentenceIndex;
      if (!seen[key] || seen[key].intensity < p.intensity) {
        seen[key] = p;
      }
    });
    return Object.values(seen).sort((a, b) => a.sentenceIndex - b.sentenceIndex);
  },

  /* ================================================================
   *  爆点强度计算
   * ================================================================ */
  calculateIntensity(type, matches, text) {
    const matchCount = matches.length;
    const textLength = text.length;
    // 匹配越多、密度越高，强度越大
    let intensity = Math.min(100, matchCount * 25 + Math.round(50 / Math.max(textLength / 20, 1)));
    // 不同类型基础强度
    const baseScore = { hook: 30, twist: 35, golden: 25, conflict: 30, suspense: 20, interact: 15 };
    intensity = Math.min(100, intensity + (baseScore[type] || 20));
    return Math.max(20, intensity);
  },

  /* ================================================================
   *  爆点深度分析 —— 有效性原理 + 可复用模板
   * ================================================================ */
  analyzePoint(point, sentences, platform) {
    const type = point.type;
    const content = point.content;
    const matchTypes = point.matches.map(m => m.pattern);

    // 识别触发的具体原理
    const principles = this.identifyPrinciples(type.id, matchTypes, content);

    // 生成可复用模板
    const template = this.generateTemplate(type.id, content, matchTypes);

    // 平台适配分析
    const platformFit = this.analyzePlatformFit(type.id, platform.key);

    return {
      ...point,
      principles,
      template,
      platformFit,
      analysis: this.generatePointAnalysis(type.id, content, matchTypes, principles, platform),
    };
  },

  /* ================================================================
   *  原理识别
   * ================================================================ */
  identifyPrinciples(typeId, matchTypes, content) {
    const principleMap = {
      hook: {
        numberHook: { name: '数字冲击', desc: '具体数字降低理解成本，增强可信度，让大脑快速做出"值得看"的判断' },
        questionHook: { name: '好奇心缺口', desc: '提问触发蔡格尼克效应——未解答的问题会在脑中持续盘旋，驱动完播' },
        negationHook: { name: '损失厌恶', desc: '否定式开头触发损失厌恶心理，"别再"暗示你正在做错事，比正面说教更有效' },
        shockHook: { name: '情绪唤醒', desc: '高强度情绪词激活杏仁核，提升注意力分配和记忆留存率' },
        contrastHook: { name: '反差制造', desc: '对比产生信息差，大脑自动补全差异原因，形成持续观看动力' },
        painHook: { name: '痛点共鸣', desc: '精准描述用户困境，触发"这说的不就是我吗"的身份认同' },
        storyHook: { name: '叙事代入', desc: '故事开头激活镜像神经元，用户不自觉代入角色，完播率显著提升' },
        commandHook: { name: '行为指令', desc: '直接给指令减少决策疲劳，用户在无意识中服从指令继续观看' },
      },
      twist: {
        turnWords: { name: '认知失调', desc: '"但是"打破已建立的预期框架，大脑被迫重新处理信息，注意力骤升' },
        truthReveal: { name: '信息差揭示', desc: '揭示"真相"让用户获得知识优越感，产生分享冲动' },
        reversal: { name: '情绪过山车', desc: '意外转折制造情绪峰谷差，峰值体验是传播的核心驱动力' },
      },
      golden: {
        parallelism: { name: '认知封装', desc: '排比结构降低记忆负荷，金句作为"知识胶囊"被截图传播' },
        antithesis: { name: '对比强化', desc: '对立结构制造张力，让观点更有记忆锚点，适合截屏分享' },
        aphorism: { name: '社交货币', desc: '精炼表达让转发者显得有品味，满足社交展示需求' },
        conditional: { name: '因果封装', desc: '"只要…就…"结构封装复杂逻辑为简单规则，降低理解门槛' },
      },
      conflict: {
        opposition: { name: '认知冲突', desc: '对立观点激活思考，评论区出现两派争论，算法推荐推升曝光' },
        negative: { name: '负面偏差', desc: '人脑对负面信息更敏感（进化生存机制），争议内容天然获得更多停留' },
        contrast: { name: '社会比较', desc: '他人 vs 自己的对比激活社会比较心理，引发"凭什么"的不平感' },
        antiConsensus: { name: '反共识吸引', desc: '颠覆常识的观点制造信息差，用户为验证而完播' },
      },
      suspense: {
        suspenseWords: { name: '蔡格尼克效应', desc: '暗示"后面有"但不立即给出，未完成的任务在记忆中保持活跃' },
        questions: { name: '好奇心缺口', desc: '设问创造信息缺口，大脑为填补缺口而持续观看' },
        delayReveal: { name: '预期管理', desc: '延迟满足提升最终揭晓时的情绪峰值，增强记忆' },
      },
      interact: {
        cta: { name: '行为指令', desc: '明确的互动指令降低参与门槛，用户在低决策成本下执行评论/点赞' },
        action: { name: '社交认同', desc: '行为引导触发从众心理，看到他人互动后跟随互动' },
        participatory: { name: '参与感制造', desc: '"你中了几条"等句式将观众从旁观者变为参与者' },
      },
    };

    const map = principleMap[typeId] || {};
    const results = [];
    matchTypes.forEach(mt => {
      if (map[mt] && !results.find(r => r.name === map[mt].name)) {
        results.push(map[mt]);
      }
    });
    // 如果没有匹配到具体原理，返回该类型的通用原理
    if (results.length === 0) {
      const type = this.VIRAL_TYPES.find(v => v.id === typeId);
      results.push({
        name: type.principles[0],
        desc: type.desc + '，通过' + type.principles.join('、') + '等机制驱动用户行为'
      });
    }
    return results;
  },

  /* ================================================================
   *  生成可复用模板
   * ================================================================ */
  generateTemplate(typeId, content, matchTypes) {
    const templates = {
      hook: {
        numberHook: () => {
          const num = content.match(/\d+/);
          return {
            template: `${num ? num[0] : 'N'}个[领域关键词]的[方法/误区/真相]，第[N]个最关键`,
            example: '3个做自媒体的致命误区，第2个90%的人都中了',
            fillGuide: '将[N]替换为3-7的数字，[领域关键词]替换为你的垂直领域',
          };
        },
        questionHook: () => ({
          template: '为什么[反常识现象]？[悬念延迟]答案可能颠覆你的认知',
          example: '为什么有些人每天只工作2小时收入却比你高？答案可能颠覆认知',
          fillGuide: '[反常识现象]选择用户熟知但存疑的场景',
        }),
        negationHook: () => ({
          template: '别再[常见做法]了！[真相/方法]才是对的',
          example: '别再死磕日更了！这个策略才是涨粉关键',
          fillGuide: '[常见做法]选用户正在做的事，形成否定反差',
        }),
        shockHook: () => ({
          template: '[震惊词]！[数据/结果]——[核心信息]',
          example: '疯了！单条视频播放破亿——AI做内容的时代来了',
          fillGuide: '用强烈情绪词开头，紧跟数据制造冲击',
        }),
        contrastHook: () => ({
          template: '[A群体]在[做某事]时，[B群体]已经[更高维的事]',
          example: '打工人还在死磕Excel时，聪明人已经用AI自动分析了',
          fillGuide: '制造身份对比，A=普通用户，B=进阶用户',
        }),
        painHook: () => ({
          template: '你是不是也[痛点场景]？[共鸣确认]——问题出在[原因]',
          example: '你是不是也每天忙到飞起却没结果？问题出在没找对方向',
          fillGuide: '精准描述用户日常痛点场景',
        }),
        storyHook: () => ({
          template: '[时间词]我[经历/事件]，[意外结果]——',
          example: '上个月我差点放弃做自媒体，结果一条视频爆了——',
          fillGuide: '用真实经历开头，制造代入感',
        }),
        commandHook: () => ({
          template: '给我[N]秒——[核心承诺]',
          example: '给我30秒——告诉你普通人怎么靠AI月入过万',
          fillGuide: '设置时间锚点+明确承诺',
        }),
      },
      twist: {
        turnWords: () => ({
          template: '[铺垫信息]。但是！[反转信息]——[情绪升华]',
          example: '我花3个月学了剪辑，但是！发现真正赚钱的根本不是剪辑——',
          fillGuide: '前半句建立预期，"但是"后立即翻转',
        }),
        truthReveal: () => ({
          template: '你以为[常见认知]？其实[真相]——[数据/案例佐证]',
          example: '你以为涨粉靠日更？其实是靠单条爆款——我有条视频涨了10万粉',
          fillGuide: '先说用户以为的，再推翻',
        }),
        reversal: () => ({
          template: '所有人都觉得[预期方向]，没想到[实际方向]——',
          example: '所有人都觉得AI会取代设计师，没想到设计师反而更值钱了——',
          fillGuide: '设置大众预期，然后用"没想到"翻转',
        }),
      },
      golden: {
        parallelism: () => ({
          template: '[动词]是[形容词]的，[动词]是[形容词]的，[动词]更是[形容词]的',
          example: '输出是孤独的，输出是痛苦的，输出更是值得的',
          fillGuide: '三个排比句，递进式情绪',
        }),
        antithesis: () => ({
          template: '不是[A]，而是[B]',
          example: '不是你没天赋，而是你没找到对标',
          fillGuide: 'A=常见误解，B=你的核心观点',
        }),
        aphorism: () => ({
          template: '[短句金句10-16字]',
          example: '认知差就是钱，执行力是放大器',
          fillGuide: '10-16字，包含因果/对比/递进关系',
        }),
        conditional: () => ({
          template: '只要[条件]，就[结果]',
          example: '只要每天拆解1条爆款，30天你就是高手',
          fillGuide: '条件要具体可执行，结果要诱人',
        }),
      },
      conflict: {
        opposition: () => ({
          template: '有人说[A]，有人说[B]——我说[你的观点]',
          example: '有人说AI是机会，有人说AI是泡沫——我说AI是工具',
          fillGuide: '先展示对立观点，再给出你的独特立场',
        }),
        negative: () => ({
          template: '[负面经历/结果]——[转折]——[正确方向]',
          example: '我花了2万报课结果啥也没学到——后来才发现免费资源就够了',
          fillGuide: '先暴露失败/痛苦，制造同情',
        }),
        contrast: () => ({
          template: '[成功者]在[做某事]时，[失败者]还在[做另一件事]',
          example: '聪明人在用AI提效，普通人还在手动肝',
          fillGuide: '制造身份对立和行动对比',
        }),
        antiConsensus: () => ({
          template: '你以为[常识观点]？恰恰相反——[反共识真相]',
          example: '你以为选择越多越好？恰恰相反——选择越多越焦虑',
          fillGuide: '找大众共识，然后直接否定',
        }),
      },
      suspense: {
        suspenseWords: () => ({
          template: '[前置信息]——接下来[悬念预告]',
          example: '我试了7种涨粉方法——接下来这个最有效',
          fillGuide: '先给部分信息，暗示后面有更重要的',
        }),
        questions: () => ({
          template: '你猜[结果怎样]？[延迟2-3句后揭晓]',
          example: '你猜结果怎样？我不是没做成——我直接翻倍了',
          fillGuide: '设问后不要立即回答，保持2-3句悬念',
        }),
        delayReveal: () => ({
          template: '这个[关键信息]我先不说——[铺垫]——[最后揭晓]',
          example: '这个方法我先不说——先讲个故事——故事讲完了，方法就是这个',
          fillGuide: '明确告诉用户"先不说"，制造期待',
        }),
      },
      interact: {
        cta: () => ({
          template: '评论区[互动指令]——[理由/激励]',
          example: '评论区扣1，我下条详细拆解这个方法',
          fillGuide: '给明确指令+后续激励',
        }),
        action: () => ({
          template: '[行为引导]+[价值暗示]',
          example: '先收藏再看，这方法你一定会回来谢我',
          fillGuide: '引导收藏/关注，暗示内容有反复查看价值',
        }),
        participatory: () => ({
          template: '你中了[几条/N条]？[互动确认]',
          example: '你中了几条？全中的评论区扣666',
          fillGuide: '将观众变参与者，设置可量化的"中招"标准',
        }),
      },
    };

    const typeTemplates = templates[typeId] || {};
    // 用第一个匹配的模式生成模板
    for (const mt of matchTypes) {
      if (typeTemplates[mt]) {
        return typeTemplates[mt]();
      }
    }
    // 兜底
    const type = this.VIRAL_TYPES.find(v => v.id === typeId);
    return {
      template: `[${type.name}模板]`,
      example: '参考同类型爆点生成',
      fillGuide: '根据具体内容调整',
    };
  },

  /* ================================================================
   *  平台适配分析
   * ================================================================ */
  analyzePlatformFit(typeId, platformKey) {
    const traits = this.PLATFORM_TRAITS[platformKey] || this.PLATFORM_TRAITS.douyin;
    const weightMap = {
      hook: traits.fastHook,
      twist: traits.emotionalTurn,
      golden: traits.golden,
      conflict: traits.conflict,
      suspense: traits.suspense,
      interact: traits.interact,
    };
    const weight = weightMap[typeId] || 0.1;
    const fitScore = Math.round(weight * 100);
    let verdict = '';
    if (fitScore >= 25) verdict = '该平台核心爆点类型，权重最高';
    else if (fitScore >= 15) verdict = '该平台重要爆点，值得强化';
    else if (fitScore >= 8) verdict = '该平台辅助爆点，锦上添花';
    else verdict = '该平台权重较低，非核心驱动因素';

    return { score: fitScore, weight, verdict };
  },

  /* ================================================================
   *  单点分析文本
   * ================================================================ */
  generatePointAnalysis(typeId, content, matchTypes, principles, platform) {
    const type = this.VIRAL_TYPES.find(v => v.id === typeId);
    const principleText = principles.map(p => p.name).join('、');
    return `【${type.icon} ${type.name}】触发原理：${principleText}。` +
      `位于文案${content.length > 20 ? content.substring(0, 20) + '...' : content}中，` +
      `通过${type.desc}。在${platform.name}平台上，${this.analyzePlatformFit(typeId, platform.key).verdict}。`;
  },

  /* ================================================================
   *  结构分析
   * ================================================================ */
  analyzeStructure(sentences) {
    const total = sentences.length;
    if (total < 3) return { completeness: 'low', missing: ['内容太少'] };

    // 检查结构完整性
    const hasHook = total >= 1;
    const hasBody = total >= 3;
    const hasEnding = total >= 4;

    // 结构比例分析
    const hookRatio = Math.min(0.2, 1 / total);
    const bodyRatio = Math.max(0.5, (total - 2) / total);
    const endingRatio = Math.min(0.2, 1 / total);

    const segments = [
      { name: '开头钩子区', ratio: hookRatio, sentences: sentences.slice(0, Math.max(1, Math.ceil(total * 0.15))) },
      { name: '内容铺垫区', ratio: 0.25, sentences: sentences.slice(Math.ceil(total * 0.15), Math.ceil(total * 0.4)) },
      { name: '价值输出区', ratio: 0.35, sentences: sentences.slice(Math.ceil(total * 0.4), Math.ceil(total * 0.75)) },
      { name: '互动结尾区', ratio: 0.25, sentences: sentences.slice(Math.ceil(total * 0.75)) },
    ];

    return {
      completeness: hasHook && hasBody && hasEnding ? 'good' : 'low',
      segments,
      totalSentences: total,
    };
  },

  /* ================================================================
   *  节奏分析
   * ================================================================ */
  analyzeRhythm(sentences) {
    const lengths = sentences.map(s => s.text.length);
    const short = lengths.filter(l => l <= 12).length;
    const medium = lengths.filter(l => l > 12 && l <= 30).length;
    const long = lengths.filter(l => l > 30).length;
    const total = lengths.length;

    const avgLen = Math.round(lengths.reduce((a, b) => a + b, 0) / total);
    const fastPct = Math.round(short / total * 100);
    const slowPct = Math.round(long / total * 100);

    let verdict = '';
    if (fastPct > 50) verdict = '快节奏，短句密集，适合短视频平台（抖音/快手）';
    else if (slowPct > 40) verdict = '慢节奏，信息密度高，适合中长视频（B站/视频号）';
    else verdict = '中等节奏，短中长句交替，比较均衡';

    return { fastPct, mediumPct: Math.round(medium / total * 100), slowPct, avgLen, verdict };
  },

  /* ================================================================
   *  三维评分
   * ================================================================ */
  calculateScores(points, sentences, platform, rhythm) {
    // 1. 爆点强度 (0-100)
    const pointCount = points.length;
    const avgIntensity = points.length > 0 ? points.reduce((sum, p) => sum + p.intensity, 0) / points.length : 0;
    const density = Math.round(pointCount / Math.max(sentences.length, 1) * 100);
    const strengthScore = Math.min(100, Math.round(avgIntensity * 0.5 + density * 0.3 + Math.min(pointCount * 5, 20)));

    // 2. 可复制性 (0-100)
    const hasTemplates = points.filter(p => p.template).length;
    const templateCoverage = Math.round(hasTemplates / Math.max(pointCount, 1) * 100);
    const structureScore = rhythm.avgLen > 15 && rhythm.avgLen < 40 ? 80 : 60;
    const replicability = Math.min(100, Math.round(templateCoverage * 0.5 + structureScore * 0.3 + 20));

    // 3. 平台适配度 (0-100)
    const platformWeights = this.PLATFORM_TRAITS[platform.key] || this.PLATFORM_TRAITS.douyin;
    const typeCoverage = {};
    points.forEach(p => {
      const w = p.platformFit ? p.platformFit.weight : 0;
      typeCoverage[p.type.id] = (typeCoverage[p.type.id] || 0) + w;
    });
    const totalWeight = Object.values(typeCoverage).reduce((a, b) => a + b, 0);
    const platformFitScore = Math.min(100, Math.round(totalWeight * 300));

    return {
      strength: { score: strengthScore, label: '爆点强度', desc: this.scoreDesc('strength', strengthScore) },
      replicability: { score: replicability, label: '可复制性', desc: this.scoreDesc('replicability', replicability) },
      platformFit: { score: platformFitScore, label: '平台适配度', desc: this.scoreDesc('platformFit', platformFitScore) },
      total: Math.round((strengthScore + replicability + platformFitScore) / 3),
    };
  },

  scoreDesc(dim, score) {
    const descs = {
      strength: {
        high: '爆点密集且强度高，具备强传播基因',
        mid: '有一定爆点但密度不够，建议增加转折和冲突',
        low: '爆点稀少，缺乏传播驱动因素',
      },
      replicability: {
        high: '结构清晰可复用，模板化程度高',
        mid: '部分可复制，但结构不够标准化',
        low: '个人化内容多，难以模板化复用',
      },
      platformFit: {
        high: '爆点类型与平台高度匹配',
        mid: '部分适配，某些爆点在目标平台权重不高',
        low: '爆点类型与平台特性不匹配，建议调整',
      },
    };
    const level = score >= 70 ? 'high' : score >= 45 ? 'mid' : 'low';
    return descs[dim][level];
  },

  /* ================================================================
   *  优化建议
   * ================================================================ */
  generateSuggestions(points, scores, platform, structure) {
    const suggestions = [];

    // 检查各类爆点缺失
    const types = points.map(p => p.type.id);
    if (!types.includes('hook')) suggestions.push({ type: 'critical', text: '缺少开头钩子！前3秒是黄金窗口，建议加入数字钩子/痛点钩子/疑问钩子' });
    if (!types.includes('twist')) suggestions.push({ type: 'important', text: '缺少情绪转折，内容平淡。建议在40%-60%位置加入"但是/结果/没想到"制造反转' });
    if (!types.includes('interact')) suggestions.push({ type: 'important', text: '缺少互动引导，评论率会很低。建议结尾加入"评论区扣X/你中了几条"' });
    if (!types.includes('golden')) suggestions.push({ type: 'optimize', text: '缺少金句，分享率会受影响。建议提炼1-2句10-16字的核心金句' });
    if (!types.includes('suspense')) suggestions.push({ type: 'optimize', text: '悬念不足，完播率可能偏低。可加入"接下来这个最关键/看到最后"' });
    if (!types.includes('conflict') && platform.key === 'douyin') suggestions.push({ type: 'optimize', text: '缺少冲突点，在抖音上争议内容更容易被推荐。可加入对立观点' });

    // 评分相关建议
    if (scores.strength.score < 50) suggestions.push({ type: 'critical', text: '爆点强度偏低（' + scores.strength.score + '分），建议增加爆点密度——每3-4句至少1个爆点' });
    if (scores.platformFit.score < 40) suggestions.push({ type: 'important', text: '平台适配度低，当前爆点类型在' + platform.name + '上权重不高，建议参考该平台热门内容的爆点结构' });
    if (scores.replicability.score < 50) suggestions.push({ type: 'optimize', text: '可复制性较低，内容偏个人化。建议提炼通用模板，方便批量产出' });

    // 如果没问题
    if (suggestions.length === 0) {
      suggestions.push({ type: 'good', text: '文案爆点结构完整，各类型爆点覆盖到位，节奏合理。可以直接进入仿写阶段' });
    }

    return suggestions;
  },

  /* ================================================================
   *  构建报告
   * ================================================================ */
  buildReport(points, scores, suggestions, platform, structure, rhythm) {
    const typeCounts = {};
    points.forEach(p => {
      typeCounts[p.type.id] = (typeCounts[p.type.id] || 0) + 1;
    });

    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const topTypeName = topType ? (this.VIRAL_TYPES.find(v => v.id === topType[0]) || {}).name : '无';

    return {
      platform: platform.name + (platform.guessed ? '（推测）' : ''),
      totalPoints: points.length,
      topType: topTypeName,
      rhythm: rhythm.verdict,
      strength: scores.strength.score,
      replicability: scores.replicability.score,
      platformFit: scores.platformFit.score,
      totalScore: scores.total,
      summary: `共提取${points.length}个爆点，主要类型：${topTypeName}。` +
        `节奏：${rhythm.verdict}。` +
        `综合评分：${scores.total}/100（${scores.total >= 70 ? '优秀' : scores.total >= 50 ? '中等' : '待优化'}）。` +
        suggestions.filter(s => s.type === 'critical').length > 0
          ? `有${suggestions.filter(s => s.type === 'critical').length}个关键问题需修复。`
          : '无关键问题。',
    };
  },
};
