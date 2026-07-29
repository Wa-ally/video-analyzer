/* ==================== 爆点仿写引擎 ====================
 *  基于分析结果，自动生成多版仿写文案
 *  - 保留原爆点逻辑，替换场景/人物/细节
 *  - 去人机感处理（口语化、短句混搭、平台黑话）
 *  - 多语气版本 × 多平台适配
 * ============================================================ */

const Rewriter = {

  /* ====== 口语化替换词典（复用+扩展） ====== */
  COLLOQUIAL: {
    '非常': ['巨', '贼', '超', '特别', '真的'],
    '特别': ['贼', '巨', '超'],
    '但是': ['但是吧', '可问题是', '结果你猜怎么着', '但是呢'],
    '所以': ['就是说', '所以呢', '结果就是'],
    '而且': ['还有就是', '关键吧', '更离谱的是'],
    '如果': ['要是', '假如说', '万一'],
    '因为': ['原因很简单', '说白了就是'],
    '然后': ['接着', '紧接着', '下一秒'],
    '虽然': ['话是这么说', '道理我都懂'],
    '可以': ['能整', '可以搞', '完全没问题'],
    '应该': ['八成得', '大概率要', '多半'],
    '已经': ['早就', '都'],
    '需要': ['得', '得先', '你必须'],
    '进行': ['干', '搞', '弄', '整'],
    '使用': ['用', '拿', '靠'],
    '开始': ['上手', '开整', '直接干'],
    '问题': ['坑', '事儿', '麻烦'],
    '方法': ['路子', '招', '办法'],
    '效果': ['结果', '出来的东西'],
    '非常重要': ['贼关键', '巨重要', '太核心了'],
    '很多人': ['10个有8个', '大部分人', '好多人'],
    '我认为': ['我觉得吧', '说真的', '我个人感觉'],
    '首先': ['第一件事', '先说第一个', '一开始'],
    '其次': ['然后呢', '接着', '第二个'],
    '最后': ['到头来', '最后吧', '说到底'],
    '总之': ['说白了', '一句话总结', '你品品'],
  },

  /* ====== 人感开头池 ====== */
  HUMAN_HOOKS: {
    douyin: ['说真的，', '别问我怎么知道的，', '先别划走！', '我问你个问题——', '讲个真事，', '你知道最离谱的是什么吗？', '前几天我差点被坑了，', '信我，', '说句掏心窝的，', '别不信，', '听我一句劝——', '有没有人跟我一样？', '别急着划，给我30秒，'],
    xhs: ['姐妹们！！', '集美们听我说！！', '谁懂啊家人们！！', '我真的会谢！！', '救命！！', '不是吧不是吧！！', '我破防了家人们，', '绝绝子姐妹们，', '我先说结论——', '先码后看！', '答应我一定要看到最后！'],
    bilibili: ['各位观众老爷，', '先叠个甲——', '有一说一，', 'UP主亲测，', '各位，', '我知道你们不信，', '这次我是认真的，', '先给结论，', '别急，听我慢慢说——', '这期可能会颠覆你的认知，'],
    kuaishou: ['老铁们，', '家人们，', '说句实在话，', '不整那些没用的，', '直接说重点——', '我跟你们讲啊，', '真的家人们，', '别不信我说的，'],
    wechat: ['朋友们，', '说句心里话，', '很多人问我，', '有件事我想了很久，', '今天说点真话——', '如果你也面临这个困惑，', '这个道理，我花了十年才想明白——'],
    default: ['说真的，', '别问我怎么知道的，', '先别划走！', '讲个真事，', '信我，', '说句掏心窝的，'],
  },

  /* ====== 情绪转折词池 ====== */
  TWIST_WORDS: ['但是！', '结果呢？', '你猜怎么着？', '最离谱的还在后面——', '但真相是——', '可偏偏——', '万万没想到，', '重点来了——', '直到我发现——', '转折来了——', '但后来我才知道，', '关键不是这个——', '但是等等，', '然而——'],

  /* ====== 互动引导词池 ====== */
  ENGAGE_PHRASES: ['评论区扣1', '评论区扣"想看"', '扣个666', '评论区告诉我你的答案', '你们说是不是？', '有同感的扣个1', '觉得有用的收藏一下', '点赞转发给需要的人', '评论区留下你的看法', '收藏起来反复看', '觉得有道理的转给朋友', '扣"学到了"', '评论区等你——'],

  /* ====== 平台黑话库 ====== */
  PLATFORM_SLANG: {
    douyin: ['上头了', '破防了', '谁懂啊', '整不会了', '绝了', '离谱', '蚌埠住了', '好家伙'],
    xhs: ['种草', '避雷', '绝绝子', 'yyds', '集美们', '谁懂啊', '破防', '上头', '真香'],
    bilibili: ['真的会谢', '蚌埠住了', '属于是', '有一说一', '好家伙', '破防了', '这波是'],
    kuaishou: ['老铁', '没毛病', '安排', '真实', '整挺好'],
    wechat: ['说得好', '深有同感', '确实如此', '人间清醒'],
  },

  /* ====== 场景替换池 ====== */
  SCENE_POOL: [
    { topic: '做自媒体', pain: '日更没人看', steps: '拆爆款→仿写→发布→复盘', result: '一个月涨了2万粉' },
    { topic: '学AI', pain: '教程太多学不完', steps: '找对标→动手做→发作品→迭代', result: '7天就能出第一件作品' },
    { topic: '搞副业', pain: '没方向没资源', steps: '选赛道→找需求→做MVP→放大', result: '第一个月就赚回了学费' },
    { topic: '做电商', pain: '流量贵转化低', steps: '选品→测款→放量→优化', result: 'ROI从1.2拉到3.5' },
    { topic: '写文案', pain: '写出来没人看', steps: '拆结构→填模板→去AI感→发布', result: '阅读量翻了10倍' },
    { topic: '拍视频', pain: '拍了不发发了不火', steps: '找选题→写脚本→拍→剪→发', result: '第3条就爆了10万播放' },
  ],

  /* ====== 语气版本配置 ====== */
  TONE_CONFIG: {
    aggressive: {
      name: '犀利版', emoji: '🔥',
      desc: '激进犀利，直接给结论，情绪强烈',
      exclamationRate: 0.35,
      sentenceEnd: ['。', '！', '！', '？'],
      hookStyle: 'shock',
    },
    gentle: {
      name: '走心版', emoji: '💜',
      desc: '温和走心，故事感强，娓娓道来',
      exclamationRate: 0.1,
      sentenceEnd: ['。', '。', '~', '……'],
      hookStyle: 'story',
    },
    professional: {
      name: '干货版', emoji: '📊',
      desc: '专业干货，逻辑清晰，信息密度高',
      exclamationRate: 0.15,
      sentenceEnd: ['。', '。', '。', '。'],
      hookStyle: 'data',
    },
  },

  /* ================================================================
   *  主仿写入口
   * ================================================================ */
  rewrite(analysisResult, { topic, platform, tones }) {
    if (!analysisResult || analysisResult.error) {
      return { error: '请先完成分析再进行仿写' };
    }
    if (!topic || topic.trim().length < 2) {
      return { error: '请输入你的主题/领域' };
    }

    const targetPlatform = platform || analysisResult.platform.key || 'douyin';
    const toneList = tones || ['aggressive', 'gentle', 'professional'];

    // 从分析结果中提取爆点结构
    const viralStructure = this.extractStructure(analysisResult);

    // 为每个语气版本生成仿写
    const versions = toneList.map(tone => {
      const config = this.TONE_CONFIG[tone];
      if (!config) return null;

      const script = this.generateScript(viralStructure, topic, targetPlatform, tone, config);
      return {
        tone,
        toneName: config.name,
        toneEmoji: config.emoji,
        platform: targetPlatform,
        ...script,
      };
    }).filter(Boolean);

    return {
      versions,
      originalStructure: viralStructure,
      topic,
      platform: targetPlatform,
    };
  },

  /* ================================================================
   *  从分析结果提取爆点结构
   * ================================================================ */
  extractStructure(result) {
    const points = result.viralPoints || [];

    // 按类型分组
    const byType = {};
    points.forEach(p => {
      if (!byType[p.type.id]) byType[p.type.id] = [];
      byType[p.type.id].push(p);
    });

    // 提取模板
    const templates = {};
    Object.keys(byType).forEach(typeId => {
      const typePoints = byType[typeId];
      if (typePoints[0] && typePoints[0].template) {
        templates[typeId] = typePoints[0].template;
      }
    });

    return {
      types: Object.keys(byType),
      points: points.map(p => ({
        type: p.type.id,
        typeName: p.type.name,
        template: p.template,
        content: p.content,
      })),
      templates,
      pointCount: points.length,
    };
  },

  /* ================================================================
   *  生成单版仿写文案
   * ================================================================ */
  generateScript(structure, topic, platform, tone, config) {
    const slang = this.PLATFORM_SLANG[platform] || this.PLATFORM_SLANG.douyin;
    const hooks = this.HUMAN_HOOKS[platform] || this.HUMAN_HOOKS.default;
    const scene = this.SCENE_POOL.find(s => s.topic.includes(topic)) || this.SCENE_POOL[0];

    // 1. 生成各段
    const segments = [];

    // 钩子段
    segments.push(this.generateHook(topic, platform, tone, config, hooks, scene, structure));

    // 铺垫段
    segments.push(this.generateSetup(topic, platform, tone, config, scene, structure));

    // 转折段
    segments.push(this.generateTwist(topic, platform, tone, config, scene, structure));

    // 价值段
    segments.push(this.generateValue(topic, platform, tone, config, scene, structure));

    // 互动段
    segments.push(this.generateEngage(platform, tone, config, structure));

    // CTA段
    segments.push(this.generateCTA(platform, tone, config));

    // 2. 组装完整文案
    const fullScript = segments.map(s => s.content).filter(Boolean).join('\n\n');

    // 3. 去人机感处理
    const humanized = this.humanize(fullScript, platform, config);

    // 4. 人感评分
    const antiAICheck = this.checkAntiAI(humanized);

    return {
      segments: segments.map((s, i) => ({ ...s, index: i })),
      fullScript: humanized,
      wordCount: humanized.replace(/\s/g, '').length,
      antiAICheck,
    };
  },

  /* ================================================================
   *  各段生成
   * ================================================================ */
  generateHook(topic, platform, tone, config, hooks, scene, structure) {
    const hook = hooks[Math.floor(Math.random() * hooks.length)];

    const styles = {
      shock: `${hook}${topic}这件事，我踩过的坑够写一本书了。`,
      story: `${hook}做${topic}第37天，我差点放弃了。`,
      data: `${hook}做${topic}3个月，数据从0到10万，方法只有4步。`,
    };

    let content = styles[config.hookStyle] || styles.shock;
    content = this.applyTone(content, config);
    return { label: '钩子开头', icon: '🎯', content };
  },

  generateSetup(topic, platform, tone, config, scene, structure) {
    const setups = [
      `你每天在${scene.topic}上花时间，${scene.pain}，对吧？`,
      `大部分人做${topic}，第一步就走错了——${scene.pain}。`,
      `我跟你说，${scene.pain}这个事儿，10个人里8个都中过。`,
    ];
    let content = setups[Math.floor(Math.random() * setups.length)];
    content = this.applyTone(content, config);
    return { label: '内容铺垫', icon: '📋', content };
  },

  generateTwist(topic, platform, tone, config, scene, structure) {
    const twistWord = this.TWIST_WORDS[Math.floor(Math.random() * this.TWIST_WORDS.length)];
    const twists = [
      `${twistWord}问题根本不是不够努力——是方向就错了。`,
      `${twistWord}你以为是${scene.pain}，其实是没人教过你正确的方法。`,
      `${twistWord}那些做得好的人，不是天赋高，是掌握了你不知道的套路。`,
    ];
    let content = twists[Math.floor(Math.random() * twists.length)];
    content = this.applyTone(content, config);
    return { label: '情绪转折', icon: '⚡', content };
  },

  generateValue(topic, platform, tone, config, scene, structure) {
    const values = [
      `就4步：${scene.steps}。按这个来，${scene.result}。别整那些花里胡哨的，就这4步反复做。`,
      `第一步：找到对标账号，拆他最火的那条。第二步：扒结构，不是抄内容。第三步：套进你的领域。第四步：发布后看数据，只复制跑得好的方向。我按这个方法，${scene.result}。`,
      `核心就一句：${scene.steps}。看着简单，但${scene.result}，谁做谁知道。`,
    ];
    let content = values[Math.floor(Math.random() * values.length)];
    content = this.applyTone(content, config);
    return { label: '价值输出', icon: '💡', content };
  },

  generateEngage(platform, tone, config, structure) {
    const phrases = this.ENGAGE_PHRASES;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    let content = `${phrase}，觉得有用收藏一下，回头翻出来照着做。`;
    content = this.applyTone(content, config);
    return { label: '互动引导', icon: '💬', content };
  },

  generateCTA(platform, tone, config) {
    const ctas = {
      douyin: ['关注我，下条接着拆。', '点个关注，不迷路。', '关注，后面更炸。'],
      xhs: ['收藏+关注，持续分享~', '姐妹们点关注不迷路~', '码住码住！关注看更多~'],
      bilibili: ['一键三连，下期更精彩。', '关注UP主，持续更新。', '投币收藏关注，三连一下。'],
      kuaishou: ['老铁们点个关注，', '双击么么哒，', '关注走一波，'],
      wechat: ['点个关注，持续更新。', '分享给需要的朋友。', '关注看更多干货。'],
    };
    const list = ctas[platform] || ctas.douyin;
    let content = list[Math.floor(Math.random() * list.length)];
    content = this.applyTone(content, config);
    return { label: '结尾CTA', icon: '🚀', content };
  },

  /* ================================================================
   *  语气应用
   * ================================================================ */
  applyTone(text, config) {
    let result = text;
    // 根据语气调整标点
    const ends = config.sentenceEnd;
    let endIdx = 0;
    result = result.replace(/[。]/g, () => {
      return ends[endIdx++ % ends.length];
    });
    return result;
  },

  /* ================================================================
   *  去人机感处理
   * ================================================================ */
  humanize(text, platform, config) {
    let result = text;

    // 1. 口语化替换
    for (const [formal, colloquial] of Object.entries(this.COLLOQUIAL)) {
      const replacement = colloquial[Math.floor(Math.random() * colloquial.length)];
      result = result.replace(new RegExp(formal, 'g'), replacement);
    }

    // 2. 长句拆分（>25字拆句）
    result = result.replace(/([^。！？\n]{25,40}[，,])/g, '$1\n');

    // 3. 标点节奏（根据语气加感叹号）
    if (config.exclamationRate > 0.2) {
      result = result.replace(/。{1}/g, () => Math.random() < config.exclamationRate ? '！' : '。');
    }

    // 4. 随机插入停顿
    const sentences = result.split(/([。！？\n])/).reduce((acc, part, i) => {
      if (i % 2 === 0 && part.trim()) acc.push(part.trim());
      else if (i % 2 === 1 && acc.length) acc[acc.length - 1] += part;
      return acc;
    }, []);

    const humanized = sentences.map(s => {
      s = s.trim();
      if (s.length < 5) return s;
      // 随机给短句加情绪
      if (Math.random() < 0.15 && s.length < 12 && !/[！？…]$/.test(s)) {
        s = s.replace(/[。]$/, '……');
      }
      return s;
    }).filter(s => s.length > 0).join('');

    // 5. 平台特殊处理
    if (platform === 'xhs') {
      // 小红书末尾加emoji
      const emojis = ['✨', '💫', '🔥', '💡', '📌'];
      humanized.replace(/。{1}/g, () => '。' + emojis[Math.floor(Math.random() * emojis.length)]);
    }

    return humanized;
  },

  /* ================================================================
   *  人感评分
   * ================================================================ */
  checkAntiAI(text) {
    const checks = [];

    // 短句比例
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    const shortSentences = sentences.filter(s => s.trim().length <= 15).length;
    const shortRate = shortSentences / Math.max(sentences.length, 1);
    checks.push({
      item: '短句混搭',
      score: shortRate > 0.35 ? 'good' : 'warn',
      detail: `短句占比${Math.round(shortRate * 100)}%，${shortRate > 0.35 ? '✅ 口语节奏感好' : '⚠️ 建议增加短句'}`,
    });

    // 口语化词汇
    const colloquialWords = ['巨', '贼', '说真的', '老实讲', '你想想', '说句', '别不信', '信我', '说白了', '就是说', '说白了', '到头来'];
    const colloquialCount = colloquialWords.filter(w => text.includes(w)).length;
    checks.push({
      item: '口语化表达',
      score: colloquialCount >= 2 ? 'good' : 'warn',
      detail: `检测到${colloquialCount}个口语化词汇，${colloquialCount >= 2 ? '✅ 人感充足' : '⚠️ 建议增加口语词'}`,
    });

    // 标点节奏
    const hasExclamation = /[！]/.test(text);
    const hasEllipsis = /[…]/.test(text);
    const hasQuestion = /[？]/.test(text);
    const punctuationVariety = [hasExclamation, hasEllipsis, hasQuestion].filter(Boolean).length;
    checks.push({
      item: '标点节奏',
      score: punctuationVariety >= 2 ? 'good' : 'warn',
      detail: `标点多样性${punctuationVariety}/3，${punctuationVariety >= 2 ? '✅ 节奏感好' : '⚠️ 建议加入！？…等标点'}`,
    });

    // 反问句式
    const hasRhetorical = /[？]/.test(text);
    checks.push({
      item: '反问句式',
      score: hasRhetorical ? 'good' : 'warn',
      detail: hasRhetorical ? '✅ 有反问句，增强互动感' : '⚠️ 建议加入反问句',
    });

    const goodCount = checks.filter(c => c.score === 'good').length;
    const totalScore = Math.round(goodCount / checks.length * 100);

    return {
      score: totalScore,
      checks,
      verdict: totalScore >= 75 ? '人感强，AI检测通过率低' : totalScore >= 50 ? '基本可以，建议优化标点节奏' : 'AI感较强，需要增加口语化表达',
    };
  },

  /* ================================================================
   *  格式化输出
   * ================================================================ */
  formatVersion(version) {
    if (version.error) return version.error;
    let out = `【${version.toneEmoji} ${version.toneName}】\n`;
    out += `${'─'.repeat(40)}\n\n`;
    version.segments.forEach(seg => {
      out += `${seg.icon} ${seg.label}\n${seg.content}\n\n`;
    });
    out += `${'─'.repeat(40)}\n`;
    out += `字数：${version.wordCount} | 人感评分：${version.antiAICheck.score}/100\n`;
    return out;
  },
};
