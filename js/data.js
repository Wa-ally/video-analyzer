/* ==================== 平台数据与热点趋势模块 ====================
 *  1. 平台特性配置
 *  2. 同类爆款视频数据（用于多平台对比）
 *  3. 爆点类型在各平台的传播效果差异
 *  4. 热点趋势数据（定时更新）
 * ============================================================ */

/* 平台配置 */
const PLATFORMS = {
  douyin:    { name: '抖音',     icon: '🎵', color: '#000000', bg: '#1a1a1a', avgDuration: 60,  desc: '快节奏，前3秒定生死，算法推荐驱动' },
  kuaishou:  { name: '快手',     icon: '⚡', color: '#ff6b35', bg: '#2a1810', avgDuration: 50,  desc: '老铁文化，信任感驱动，直播转化强' },
  xhs:       { name: '小红书',   icon: '📕', color: '#ff2442', bg: '#2a0f15', avgDuration: 90,  desc: '种草社区，图文优先，搜索流量大' },
  bilibili:  { name: 'B站',      icon: '📺', color: '#00a1d6', bg: '#0a1e2a', avgDuration: 180, desc: '知识社区，弹幕互动，中长视频为主' },
  wechat:    { name: '视频号',   icon: '💬', color: '#07c160', bg: '#0a2418', avgDuration: 120, desc: '社交裂变，私域流量，中年用户多' },
  youtube:   { name: 'YouTube', icon: '▶',  color: '#ff0000', bg: '#2a0a0a', avgDuration: 300, desc: '全球平台，搜索+推荐，长视频为主' },
};

/* 爆点类型在各平台的传播效果基准数据 */
const VIRAL_TYPE_PERFORMANCE = {
  hook: {
    name: '标题钩子',
    douyin:    { avgCompleteRate: 0.65, avgLikeRate: 0.05, avgCommentRate: 0.008, desc: '抖音核心——前3秒钩子决定80%完播率' },
    kuaishou:  { avgCompleteRate: 0.55, avgLikeRate: 0.06, avgCommentRate: 0.012, desc: '快手用户对钩子容忍度稍低，但信任建立后互动更高' },
    xhs:       { avgCompleteRate: 0.40, avgLikeRate: 0.08, avgCommentRate: 0.015, desc: '小红书标题>视频内容，封面+标题是第一钩子' },
    bilibili:  { avgCompleteRate: 0.35, avgLikeRate: 0.04, avgCommentRate: 0.020, desc: 'B站用户对标题党容忍度低，标题需匹配内容' },
    wechat:    { avgCompleteRate: 0.30, avgLikeRate: 0.03, avgCommentRate: 0.005, desc: '视频号靠社交分发，标题影响点击但非核心' },
  },
  twist: {
    name: '情绪转折',
    douyin:    { avgCompleteRate: 0.70, avgLikeRate: 0.08, avgCommentRate: 0.015, desc: '情绪转折是抖音完播率第一驱动因素' },
    kuaishou:  { avgCompleteRate: 0.65, avgLikeRate: 0.10, avgCommentRate: 0.020, desc: '快手老铁对真实情感转折反应强烈' },
    xhs:       { avgCompleteRate: 0.50, avgLikeRate: 0.06, avgCommentRate: 0.012, desc: '小红书更看重内容价值，转折效果中等' },
    bilibili:  { avgCompleteRate: 0.55, avgLikeRate: 0.05, avgCommentRate: 0.025, desc: 'B站长视频中转折是关键节奏点' },
    wechat:    { avgCompleteRate: 0.45, avgLikeRate: 0.04, avgCommentRate: 0.008, desc: '视频号转折能拉升分享率' },
  },
  golden: {
    name: '金句提炼',
    douyin:    { avgCompleteRate: 0.40, avgLikeRate: 0.12, avgCommentRate: 0.020, desc: '金句是抖音收藏和分享的第一驱动' },
    kuaishou:  { avgCompleteRate: 0.35, avgLikeRate: 0.08, avgCommentRate: 0.015, desc: '快手金句传播力稍弱，但能提升关注率' },
    xhs:       { avgCompleteRate: 0.50, avgLikeRate: 0.15, avgCommentRate: 0.025, desc: '小红书金句是收藏率第一驱动' },
    bilibili:  { avgCompleteRate: 0.60, avgLikeRate: 0.10, avgCommentRate: 0.030, desc: 'B站金句会被弹幕刷屏，形成社区记忆' },
    wechat:    { avgCompleteRate: 0.50, avgLikeRate: 0.12, avgCommentRate: 0.015, desc: '视频号金句直接驱动朋友圈转发' },
  },
  conflict: {
    name: '冲突点',
    douyin:    { avgCompleteRate: 0.55, avgLikeRate: 0.04, avgCommentRate: 0.030, desc: '抖音冲突点大幅提升评论率，算法爱推' },
    kuaishou:  { avgCompleteRate: 0.50, avgLikeRate: 0.03, avgCommentRate: 0.025, desc: '快手冲突需把握尺度，过度冲突伤信任' },
    xhs:       { avgCompleteRate: 0.30, avgLikeRate: 0.02, avgCommentRate: 0.015, desc: '小红书冲突容易翻车，慎用' },
    bilibili:  { avgCompleteRate: 0.45, avgLikeRate: 0.03, avgCommentRate: 0.035, desc: 'B站用户爱辩论，冲突点能拉长观看时长' },
    wechat:    { avgCompleteRate: 0.25, avgLikeRate: 0.02, avgCommentRate: 0.010, desc: '视频号冲突内容容易被限流' },
  },
  suspense: {
    name: '悬念设置',
    douyin:    { avgCompleteRate: 0.60, avgLikeRate: 0.03, avgCommentRate: 0.010, desc: '抖音悬念是完播率重要驱动' },
    kuaishou:  { avgCompleteRate: 0.50, avgLikeRate: 0.03, avgCommentRate: 0.008, desc: '快手悬念效果中等' },
    xhs:       { avgCompleteRate: 0.55, avgLikeRate: 0.05, avgCommentRate: 0.012, desc: '小红书悬念能拉升图文阅读完成率' },
    bilibili:  { avgCompleteRate: 0.65, avgLikeRate: 0.04, avgCommentRate: 0.020, desc: 'B站悬念是中长视频的核心结构' },
    wechat:    { avgCompleteRate: 0.40, avgLikeRate: 0.02, avgCommentRate: 0.005, desc: '视频号悬念效果一般' },
  },
  interact: {
    name: '互动引导',
    douyin:    { avgCompleteRate: 0.30, avgLikeRate: 0.02, avgCommentRate: 0.025, desc: '抖音互动引导直接拉评论率' },
    kuaishou:  { avgCompleteRate: 0.25, avgLikeRate: 0.02, avgCommentRate: 0.030, desc: '快手互动引导效果最强' },
    xhs:       { avgCompleteRate: 0.35, avgLikeRate: 0.04, avgCommentRate: 0.020, desc: '小红书互动引导需配合内容价值' },
    bilibili:  { avgCompleteRate: 0.30, avgLikeRate: 0.02, avgCommentRate: 0.015, desc: 'B站互动引导靠弹幕文化' },
    wechat:    { avgCompleteRate: 0.20, avgLikeRate: 0.01, avgCommentRate: 0.005, desc: '视频号互动引导效果最弱' },
  },
};

/* 同类爆款视频对比数据（用于多平台对比展示） */
const COMPARISON_VIDEOS = [
  {
    id: 'cmp001',
    title: '3分钟学会用AI写爆款文案',
    category: 'AIGC培训',
    platforms: {
      douyin:   { views: 580000,  likes: 28000,  comments: 1200,  shares: 3400,  completeRate: 0.62 },
      bilibili: { views: 320000,  likes: 15000,  comments: 2800,  shares: 1200,  completeRate: 0.48 },
      xhs:      { views: 150000,  likes: 12000,  comments: 850,   shares: 2200,  completeRate: 0.55 },
      kuaishou: { views: 420000,  likes: 22000,  comments: 1800,  shares: 1500,  completeRate: 0.58 },
    },
    date: '2026-07-20',
    tags: ['AIGC', '文案', '教程'],
  },
  {
    id: 'cmp002',
    title: 'AI生成短视频的5个致命误区',
    category: 'AIGC培训',
    platforms: {
      douyin:   { views: 1200000, likes: 58000,  comments: 4200,  shares: 8900,  completeRate: 0.68 },
      bilibili: { views: 680000,  likes: 32000,  comments: 5600,  shares: 3400,  completeRate: 0.55 },
      xhs:      { views: 280000,  likes: 22000,  comments: 1500,  shares: 4200,  completeRate: 0.52 },
      kuaishou: { views: 850000,  likes: 45000,  comments: 3200,  shares: 5600,  completeRate: 0.60 },
    },
    date: '2026-07-18',
    tags: ['AI视频', '避坑', '教程'],
  },
  {
    id: 'cmp003',
    title: '我用AI做了条视频，播放破百万',
    category: 'AIGC作品',
    platforms: {
      douyin:   { views: 2300000, likes: 135000, comments: 8900,  shares: 23000, completeRate: 0.72 },
      bilibili: { views: 890000,  likes: 56000,  comments: 12000, shares: 8900,  completeRate: 0.65 },
      xhs:      { views: 450000,  likes: 38000,  comments: 3200,  shares: 8500,  completeRate: 0.58 },
      kuaishou: { views: 1600000, likes: 89000,  comments: 6500,  shares: 15000, completeRate: 0.65 },
    },
    date: '2026-07-15',
    tags: ['AI短片', '爆款', '实战'],
  },
  {
    id: 'cmp004',
    title: '普通人也能用AI做动画——0基础教程',
    category: 'AIGC培训',
    platforms: {
      douyin:   { views: 890000,  likes: 42000,  comments: 3500,  shares: 6800,  completeRate: 0.60 },
      bilibili: { views: 520000,  likes: 28000,  comments: 4500,  shares: 2800,  completeRate: 0.58 },
      xhs:      { views: 220000,  likes: 18000,  comments: 1200,  shares: 3500,  completeRate: 0.50 },
      kuaishou: { views: 680000,  likes: 35000,  comments: 2800,  shares: 4200,  completeRate: 0.55 },
    },
    date: '2026-07-12',
    tags: ['AI动画', '教程', '0基础'],
  },
  {
    id: 'cmp005',
    title: 'DeepSeek+即梦AI，3分钟出片',
    category: 'AIGC培训',
    platforms: {
      douyin:   { views: 1500000, likes: 78000,  comments: 5600,  shares: 12000, completeRate: 0.66 },
      bilibili: { views: 950000,  likes: 48000,  comments: 8200,  shares: 5600,  completeRate: 0.62 },
      xhs:      { views: 380000,  likes: 32000,  comments: 2200,  shares: 6800,  completeRate: 0.55 },
      kuaishou: { views: 1100000, likes: 58000,  comments: 4200,  shares: 8500,  completeRate: 0.58 },
    },
    date: '2026-07-10',
    tags: ['DeepSeek', '即梦AI', '教程'],
  },
];

/* 热点趋势数据 - 按周更新 */
const TREND_DATA = {
  lastUpdate: '2026-09-04',
  weeklyHot: [
    { rank: 1,  keyword: 'AI短剧2853亿播放',  growth: '+423%',  platform: 'douyin',   avgLikes: 120000, category: 'AI短剧' },
    { rank: 2,  keyword: 'AI仿真人剧占七成',  growth: '+150%',  platform: 'douyin',   avgLikes: 95000,  category: 'AI短剧' },
    { rank: 3,  keyword: 'AI猎奇短剧出海',    growth: '+120%',  platform: 'douyin',   avgLikes: 160000, category: 'AI短剧出海' },
    { rank: 4,  keyword: '东方志怪AI短剧',    growth: '+85%',   platform: 'douyin',   avgLikes: 200000, category: 'AI短剧' },
    { rank: 5,  keyword: '快手AIGC日均109万条', growth: '+75%',   platform: 'kuaishou', avgLikes: 52000,  category: 'AIGC生态' },
    { rank: 6,  keyword: '真情实感内容回归',   growth: '+68%',   platform: 'xhs',      avgLikes: 42000,  category: '自媒体趋势' },
    { rank: 7,  keyword: '小众赛道变现',       growth: '+55%',   platform: 'kuaishou', avgLikes: 38000,  category: '自媒体趋势' },
    { rank: 8,  keyword: 'AI短剧精品化',      growth: '+34%',   platform: 'douyin',   avgLikes: 88000,  category: 'AI短剧' },
    { rank: 9,  keyword: 'AI微短剧标识新规',   growth: '+30%',   platform: 'douyin',   avgLikes: 65000,  category: '政策法规' },
    { rank: 10, keyword: '重生逆袭高频词',     growth: '+25%',   platform: 'douyin',   avgLikes: 72000,  category: 'AI短剧' },
  ],
  platformTrends: {
    douyin:   { avgViews: 2800000, avgLikes: 120000, avgComments: 8500,  hotCategories: ['AI短剧', 'AI仿真人剧', '东方志怪', 'AI猎奇出海'] },
    bilibili: { avgViews: 820000,  avgLikes: 48000,  avgComments: 6800,  hotCategories: ['AI二创', 'AI科普', 'AI动画', '视频播客'] },
    xhs:      { avgViews: 420000,  avgLikes: 38000,  avgComments: 2400,  hotCategories: ['真情实感内容', 'AI穿搭', '观鸟', '前额叶'] },
    kuaishou: { avgViews: 920000,  avgLikes: 52000,  avgComments: 3500,  hotCategories: ['AIGC日均109万条', '小众赛道', 'AI老铁故事', 'AI经典奇谈'] },
  },
  dataSource: 'DataEye 2026上半年AI剧漫剧数据报告、流媒体网8月AI短剧市场数据、2026快手光合大会AIGC分论坛、腾讯新闻2026爆款复盘、大公报AI短剧产业报道等公开数据整理',
  updateNote: '数据为公开报道整理。2026年8月AI短剧播放量达2853亿创新高，TOP5均破10亿；AI仿真人剧占比超70%；TikTok AI猎奇短剧出海爆发；快手2.8亿日活消费AIGC内容；素人真情实感内容完播率比AI高3.2倍。2026-09-04更新。',
};

/* 爆点评分权重配置 */
const SCORE_WEIGHTS = {
  strength: {
    intensity: 0.35,   // 爆点强度
    density: 0.30,     // 爆点密度
    coverage: 0.20,     // 类型覆盖
    position: 0.15,     // 位置合理性
  },
  replicability: {
    templateCoverage: 0.40,  // 模板覆盖率
    structureClarity: 0.30,  // 结构清晰度
    generality: 0.30,        // 通用性
  },
  platformFit: {
    typeWeight: 0.50,  // 类型权重匹配
    rhythm: 0.25,       // 节奏匹配
    duration: 0.25,     // 时长匹配
  },
};
