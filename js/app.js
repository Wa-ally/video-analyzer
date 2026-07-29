/* ==================== 爆款视频分析器 - 主控逻辑 ==================== */

const App = {
  currentAnalysis: null,
  currentView: 'home',

  /* === 工具函数 === */
  escapeHTML(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  formatNum(n) {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return (n || 0).toString();
  },
  formatPct(n) { return (n * 100).toFixed(1) + '%'; },
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  },
  showLoading(text) {
    document.getElementById('loadingText').textContent = text || '处理中...';
    document.getElementById('loadingOverlay').style.display = 'flex';
  },
  hideLoading() { document.getElementById('loadingOverlay').style.display = 'none'; },
  switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    this.currentView = viewId;
    window.scrollTo(0, 0);
  },
  updateNav(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  },

  /* === 首页 === */
  showHome() {
    this.switchView('homeView');
    this.updateNav('home');
    this.hideExtractProgress();
  },

  switchInputTab(tab) {
    document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.input-area').forEach(a => a.classList.remove('active'));
    document.getElementById(tab === 'text' ? 'textInputArea' : tab === 'link' ? 'linkInputArea' : 'extractInputArea').classList.add('active');
    // 隐藏/显示分析按钮
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (tab === 'extract') {
      analyzeBtn.style.display = 'none';
    } else {
      analyzeBtn.style.display = 'block';
    }
  },

  /* === 视频提取功能 === */
  _extractMode: 'link',
  _selectedFile: null,
  _extractionResult: null,

  switchExtractMode(mode) {
    this._extractMode = mode;
    document.querySelectorAll('.extract-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    document.querySelectorAll('.extract-mode-area').forEach(a => a.classList.remove('active'));
    document.getElementById(mode === 'link' ? 'extractLinkMode' : 'extractFileMode').classList.add('active');
  },

  onFileSelected(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      this.toast('请选择视频文件（MP4/WEBM/MOV）');
      input.value = '';
      return;
    }
    this._selectedFile = file;
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const info = document.getElementById('fileInfo');
    info.style.display = 'block';
    info.innerHTML = `
      <div class="file-info-row">
        <span class="file-info-icon">🎬</span>
        <div class="file-info-detail">
          <div class="file-info-name">${this.escapeHTML(file.name)}</div>
          <div class="file-info-meta">${sizeMB} MB · ${file.type || '视频文件'}</div>
        </div>
        <button class="file-info-remove" onclick="App.clearFile()">✕</button>
      </div>
    `;
  },

  clearFile() {
    this._selectedFile = null;
    document.getElementById('videoFileInput').value = '';
    document.getElementById('fileInfo').style.display = 'none';
  },

  showExtractProgress(pct, text, phase) {
    const prog = document.getElementById('extractProgress');
    const fill = document.getElementById('extractProgressFill');
    const txt = document.getElementById('extractProgressText');
    prog.style.display = 'block';
    fill.style.width = pct + '%';
    txt.textContent = text;
  },

  hideExtractProgress() {
    document.getElementById('extractProgress').style.display = 'none';
  },

  async runExtraction() {
    if (this._extractMode === 'link') {
      const url = document.getElementById('extractLinkInput').value.trim();
      if (url.length < 5) { this.toast('请输入视频链接'); return; }
      this.showExtractProgress(5, '正在识别平台...', 'link');
      try {
        const result = await Extractor.extractFromLink(url);
        this.hideExtractProgress();
        if (result.error) { this.toast(result.error); return; }
        if (!result.segments || result.segments.length === 0) {
          this.toast('未能提取到文案内容，请尝试上传视频文件进行 OCR 提取');
          return;
        }
        this._extractionResult = result;
        this.renderExtractionResult(result);
        this.switchView('extractView');
      } catch (e) {
        this.hideExtractProgress();
        this.toast('提取失败：' + e.message + '。请尝试上传视频文件');
      }
    } else {
      if (!this._selectedFile) { this.toast('请先选择视频文件'); return; }
      this.showExtractProgress(0, '正在加载视频...', 'file');
      try {
        const result = await Extractor.extractFromVideoFile(
          this._selectedFile,
          (pct, text, phase) => this.showExtractProgress(pct, text, phase)
        );
        this.hideExtractProgress();
        if (!result.segments || result.segments.length === 0) {
          this.toast('未能提取到文案内容');
          return;
        }
        this._extractionResult = result;
        this.renderExtractionResult(result);
        this.switchView('extractView');
      } catch (e) {
        this.hideExtractProgress();
        this.toast('提取失败：' + e.message);
      }
    }
  },

  renderExtractionResult(result) {
    const content = document.getElementById('extractContent');
    let html = '';

    // 概览卡片
    html += `
      <div class="result-card">
        <div class="result-header">
          <h3>🎬 提取结果</h3>
          <span class="platform-badge">${result.platform?.icon || '📹'} ${result.platform?.name || '视频'}</span>
        </div>
        ${result.title ? `<div style="font-size:0.95rem;font-weight:600;margin-bottom:8px;">${this.escapeHTML(result.title)}</div>` : ''}
        ${result.description ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;line-height:1.6;">${this.escapeHTML(result.description)}</div>` : ''}
        <div class="extract-meta">
          <span>📝 ${result.segments.length} 段文案</span>
          <span>🔧 ${result.source || '提取'}</span>
          ${result.duration ? `<span>⏱ ${Math.floor(result.duration / 60)}分${Math.round(result.duration % 60)}秒</span>` : ''}
        </div>
        ${result.methods && result.methods.length > 0 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;">提取方式：${result.methods.filter(m => !m.includes('failed')).join('、')}</div>` : ''}
      </div>
    `;

    // 操作按钮
    html += `
      <div class="extract-actions">
        <button class="extract-action-btn primary" onclick="App.analyzeExtracted()">🔍 分析爆点</button>
        <button class="extract-action-btn" onclick="App.copyExtracted()">📋 复制全文</button>
        <button class="extract-action-btn" onclick="App.exportExtracted('txt')">📄 导出TXT</button>
        <button class="extract-action-btn" onclick="App.exportExtracted('srt')">🎬 导出SRT</button>
        <button class="extract-action-btn" onclick="App.exportExtracted('json')">💾 导出JSON</button>
      </div>
    `;

    // 时间轴
    html += '<div class="result-card"><div class="result-header"><h3>📋 文案时间轴</h3></div>';
    html += '<div class="timeline">';
    result.segments.forEach((seg, i) => {
      const timeStr = Extractor.formatTimecodeShort(seg.start);
      const sourceIcon = Extractor.getSourceIcon(seg.source);
      const sourceName = Extractor.getSourceName(seg.source);
      const confClass = seg.confidence === 'high' ? 'high' : seg.confidence === 'low' ? 'low' : '';
      html += `
        <div class="timeline-item" data-index="${i}">
          <div class="timeline-time">${timeStr}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-text" id="seg-text-${i}">${this.escapeHTML(seg.text)}</div>
            <div class="timeline-meta">
              <span class="timeline-source">${sourceIcon} ${sourceName}</span>
              ${seg.confidence ? `<span class="timeline-conf ${confClass}">${seg.confidence === 'high' ? '高' : seg.confidence === 'medium' ? '中' : '低'}可信度</span>` : ''}
              <button class="timeline-edit-btn" onclick="App.editSegment(${i})">✏️ 编辑</button>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div></div>';

    content.innerHTML = html;
  },

  editSegment(i) {
    const el = document.getElementById(`seg-text-${i}`);
    if (!el) return;
    const currentText = el.textContent;
    const isEditing = el.querySelector('textarea');
    if (isEditing) {
      // 保存
      const newText = isEditing.value.trim();
      if (newText) {
        this._extractionResult.segments[i].text = newText;
      }
      el.innerHTML = this.escapeHTML(newText || currentText);
      this.toast('已保存');
    } else {
      // 进入编辑
      el.innerHTML = `<textarea class="seg-edit-textarea" rows="3">${this.escapeHTML(currentText)}</textarea>`;
      const ta = el.querySelector('textarea');
      ta.focus();
      ta.addEventListener('blur', () => this.editSegment(i));
    }
  },

  analyzeExtracted() {
    if (!this._extractionResult || !this._extractionResult.segments) return;
    const text = Extractor.mergeToPlainText(this._extractionResult.segments);
    if (text.length < 15) { this.toast('提取的文案太短，无法分析'); return; }

    this.showLoading('正在分析爆点...');
    setTimeout(() => {
      try {
        const result = Analyzer.analyze(text);
        if (result.error) { this.hideLoading(); this.toast(result.error); return; }
        this.currentAnalysis = result;
        this.renderAnalysis(result);
        this.hideLoading();
        this.switchView('analysisView');
      } catch (e) {
        this.hideLoading();
        this.toast('分析出错：' + e.message);
      }
    }, 600);
  },

  copyExtracted() {
    if (!this._extractionResult) return;
    const text = Extractor.exportToTXT(this._extractionResult.segments, this._extractionResult.title);
    navigator.clipboard.writeText(text).then(() => this.toast('已复制到剪贴板'));
  },

  exportExtracted(format) {
    if (!this._extractionResult) return;
    const segs = this._extractionResult.segments;
    const title = this._extractionResult.title || '视频文案';
    const date = new Date().toISOString().slice(0, 10);

    if (format === 'txt') {
      const txt = Extractor.exportToTXT(segs, title);
      Extractor.downloadFile(txt, `${title}_${date}.txt`, 'text/plain');
    } else if (format === 'srt') {
      const srt = Extractor.exportToSRT(segs);
      Extractor.downloadFile(srt, `${title}_${date}.srt`, 'text/plain');
    } else if (format === 'json') {
      const json = Extractor.exportToJSON(segs, {
        title,
        platform: this._extractionResult.platform?.key,
        source: this._extractionResult.source,
        url: this._extractionResult.url,
      });
      Extractor.downloadFile(json, `${title}_${date}.json`, 'application/json');
    }
    this.toast(`已导出 ${format.toUpperCase()} 文件`);
  },

  /* === 快捷示例 === */
  loadExamples() {
    const examples = [
      '3个做自媒体的致命误区，第2个90%的人都中了。你是不是每天忙到飞起却没结果？问题出在没找对方向。但是！真正赚钱的根本不是日更——是找到对标拆解。第一步找对标，第二步拆结构，第三步套进你的领域。评论区扣1，我下条详细拆。关注我，下条接着拆。',
      '万万没想到，我用AI做了一条视频，播放破百万。之前我花3个月学剪辑，结果发现根本不需要——但是！关键不是工具好不好，是你知不知道拆解爆款。说白了，就是拆对标→仿结构→填你的内容→发布。评论区告诉我你想做什么领域，我帮你拆。收藏+关注，持续更新。',
      '别再死磕日更了！我做了200条视频才发现，1条爆款=100条平庸内容。你信吗？那些涨粉快的人，不是更新多，是每条都有爆点。但真相是——爆点不是灵感，是结构。第一步，3秒钩子。第二步，反转。第三步，干货。第四步，互动。你中了几条？全中的扣666。',
      '凭什么别人做AI内容月入3万，你连3百都赚不到？不是你不够努力——是你搞反了。你以为要先学技术？恰恰相反——先找需求。第一步：搜热点。第二步：找对标。第三步：套模板。就这三步。结果呢？我第一个月就赚回了学费。评论区扣"想学"，我详细教你。',
    ];
    const list = document.getElementById('exampleList');
    list.innerHTML = examples.map((text, i) =>
      `<div class="example-item" onclick="App.useExample(${i})">${text.substring(0, 60)}...</div>`
    ).join('');
    this._examples = examples;
  },
  useExample(i) {
    this.switchInputTab('text');
    document.getElementById('scriptInput').value = this._examples[i];
  },

  /* === 分析入口 === */
  runAnalysis() {
    const textTab = document.querySelector('[data-tab="text"]').classList.contains('active');
    const linkTab = document.querySelector('[data-tab="link"]').classList.contains('active');
    if (!textTab && !linkTab) { this.toast('请使用提取功能或切换到文案/链接输入'); return; }
    let input;
    if (textTab) {
      input = document.getElementById('scriptInput').value.trim();
      if (input.length < 15) { this.toast('请输入至少15字的文案'); return; }
    } else {
      input = document.getElementById('linkInput').value.trim();
      if (input.length < 5) { this.toast('请输入有效的链接'); return; }
    }

    this.showLoading('正在分析爆点...');
    setTimeout(() => {
      try {
        const result = Analyzer.analyze(input);
        if (result.error) {
          this.hideLoading();
          this.toast(result.error);
          return;
        }
        this.currentAnalysis = result;
        this.renderAnalysis(result);
        this.hideLoading();
        this.switchView('analysisView');
      } catch (e) {
        this.hideLoading();
        this.toast('分析出错：' + e.message);
      }
    }, 600);
  },

  /* === 渲染分析结果 === */
  renderAnalysis(result) {
    const content = document.getElementById('analysisContent');
    const platform = result.platform;
    const scores = result.scores;

    let html = '';

    // 1. 概览卡片
    html += `
      <div class="result-card">
        <div class="result-header">
          <h3>📋 分析概览</h3>
          <span class="platform-badge ${platform.key}">${platform.icon} ${platform.name}${platform.guessed ? '（推测）' : ''}</span>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:12px;font-size:0.82rem;color:var(--text-secondary);">
          <span>📝 ${result.wordCount}字</span>
          <span>💬 ${result.sentenceCount}句</span>
          <span>🎯 ${result.viralPoints.length}个爆点</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.7;">${result.report.summary}</div>
      </div>
    `;

    // 2. 评分卡片
    html += this.renderScores(scores);

    // 3. 爆点详情
    if (result.viralPoints.length > 0) {
      html += `<div class="result-card"><div class="result-header"><h3>🎯 爆点详情（${result.viralPoints.length}个）</h3></div>`;
      result.viralPoints.forEach(p => { html += this.renderViralPoint(p); });
      html += '</div>';
    } else {
      html += `<div class="result-card" style="text-align:center;color:var(--text-muted);padding:24px;">未检测到明显爆点，建议优化文案结构</div>`;
    }

    // 4. 节奏分析
    html += this.renderRhythm(result.rhythm);

    // 5. 优化建议
    if (result.suggestions.length > 0) {
      html += `<div class="result-card"><div class="result-header"><h3>💡 优化建议</h3></div>`;
      result.suggestions.forEach(s => {
        const icons = { critical: '🚨', important: '⚠️', optimize: '🔧', good: '✅' };
        html += `<div class="suggestion ${s.type}"><span class="suggestion-icon">${icons[s.type] || '💡'}</span><span>${this.escapeHTML(s.text)}</span></div>`;
      });
      html += '</div>';
    }

    // 6. 仿写按钮
    html += `
      <button class="analyze-btn" onclick="App.openRewriteModal()" style="margin-bottom:16px;">
        ✍️ 基于爆点结构仿写文案
      </button>
    `;

    content.innerHTML = html;
  },

  renderScores(scores) {
    const scoreClass = (s) => s >= 70 ? 'high' : s >= 45 ? 'mid' : 'low';
    return `
      <div class="result-card">
        <div class="result-header"><h3>⭐ 爆点评分报告</h3></div>
        <div class="score-total">
          <div class="num">${scores.total}</div>
          <div class="label">综合评分 / 100</div>
        </div>
        <div class="score-card">
          <div class="score-item">
            <div class="score-circle ${scoreClass(scores.strength.score)}">${scores.strength.score}</div>
            <div class="score-label">${scores.strength.label}</div>
            <div class="score-desc">${scores.strength.desc}</div>
          </div>
          <div class="score-item">
            <div class="score-circle ${scoreClass(scores.replicability.score)}">${scores.replicability.score}</div>
            <div class="score-label">${scores.replicability.label}</div>
            <div class="score-desc">${scores.replicability.desc}</div>
          </div>
          <div class="score-item">
            <div class="score-circle ${scoreClass(scores.platformFit.score)}">${scores.platformFit.score}</div>
            <div class="score-label">${scores.platformFit.label}</div>
            <div class="score-desc">${scores.platformFit.desc}</div>
          </div>
        </div>
      </div>
    `;
  },

  renderViralPoint(p) {
    const type = p.type;
    let html = `
      <div class="viral-point vp-${type.id}">
        <div class="vp-header">
          <div class="vp-type">${type.icon} ${type.name}</div>
          <div class="vp-position">📍 第${p.sentenceIndex + 1}句 · 约${p.estimatedTime}秒处 · 位置${p.positionPct}%</div>
        </div>
        <div class="vp-content">"${this.escapeHTML(p.content)}"</div>
        <div class="vp-intensity-bar">
          <div class="vp-intensity-fill" style="width:${p.intensity}%;background:${type.color};"></div>
        </div>
    `;

    // 触发原理
    if (p.principles && p.principles.length > 0) {
      html += '<div class="vp-principles">';
      p.principles.forEach(pr => {
        html += `<span class="vp-principle">${this.escapeHTML(pr.name)}</span>`;
      });
      html += '</div>';
      p.principles.forEach(pr => {
        html += `<div class="vp-principle-desc">→ ${this.escapeHTML(pr.desc)}</div>`;
      });
    }

    // 可复用模板
    if (p.template) {
      html += `
        <div class="vp-template">
          <div class="vp-template-label">📝 可复用模板</div>
          <div class="vp-template-code">${this.escapeHTML(p.template.template)}</div>
          <div class="vp-template-example">💡 示例：${this.escapeHTML(p.template.example)}</div>
          <div class="vp-template-guide">⚙️ ${this.escapeHTML(p.template.fillGuide)}</div>
        </div>
      `;
    }

    // 平台适配
    if (p.platformFit) {
      html += `<div class="vp-platform-fit">📊 平台适配：${p.platformFit.score}/100 — ${this.escapeHTML(p.platformFit.verdict)}</div>`;
    }

    html += '</div>';
    return html;
  },

  renderRhythm(rhythm) {
    return `
      <div class="result-card">
        <div class="result-header"><h3>🎵 节奏分析</h3></div>
        <div class="rhythm-bar">
          <div class="rhythm-fast" style="width:${rhythm.fastPct}%"></div>
          <div class="rhythm-medium" style="width:${rhythm.mediumPct}%"></div>
          <div class="rhythm-slow" style="width:${rhythm.slowPct}%"></div>
        </div>
        <div class="rhythm-labels">
          <span>短句 ${rhythm.fastPct}%</span>
          <span>中句 ${rhythm.mediumPct}%</span>
          <span>长句 ${rhythm.slowPct}%</span>
        </div>
        <div class="rhythm-verdict">📊 ${rhythm.verdict} · 平均句长${rhythm.avgLen}字</div>
      </div>
    `;
  },

  /* === 仿写 === */
  openRewriteModal() {
    if (!this.currentAnalysis) { this.toast('请先完成分析'); return; }
    document.getElementById('rewriteModal').style.display = 'flex';
    // 预填平台
    document.getElementById('rewritePlatform').value = this.currentAnalysis.platform.key || 'douyin';
  },
  closeRewriteModal() {
    document.getElementById('rewriteModal').style.display = 'none';
  },
  runRewrite() {
    const topic = document.getElementById('rewriteTopic').value.trim();
    if (topic.length < 2) { this.toast('请输入你的主题/领域'); return; }
    const platform = document.getElementById('rewritePlatform').value;
    const tones = Array.from(document.querySelectorAll('.checkbox-item input:checked')).map(c => c.value);
    if (tones.length === 0) { this.toast('至少选一个语气版本'); return; }

    this.closeRewriteModal();
    this.showLoading('正在生成仿写文案...');

    setTimeout(() => {
      try {
        const result = Rewriter.rewrite(this.currentAnalysis, { topic, platform, tones });
        if (result.error) { this.hideLoading(); this.toast(result.error); return; }
        this.renderRewrite(result);
        this.hideLoading();
        this.switchView('rewriteView');
      } catch (e) {
        this.hideLoading();
        this.toast('仿写出错：' + e.message);
      }
    }, 600);
  },

  renderRewrite(result) {
    const content = document.getElementById('rewriteContent');
    let html = `
      <div class="result-card">
        <div class="result-header"><h3>✍️ 仿写结果</h3></div>
        <div style="font-size:0.85rem;color:var(--text-secondary);">
          主题：${this.escapeHTML(result.topic)} · 平台：${PLATFORMS[result.platform]?.name || result.platform} · ${result.versions.length}个版本
        </div>
        <button class="analyze-btn" onclick="App.openRewriteModal()" style="margin-top:12px;">🔄 重新生成</button>
      </div>
    `;

    result.versions.forEach((v, i) => {
      html += `
        <div class="rewrite-version">
          <div class="rewrite-header">
            <span class="rewrite-tone-badge" style="background:${this.toneColor(v.tone)};color:#fff;">${v.toneEmoji} ${v.toneName}</span>
            <span style="font-size:0.78rem;color:var(--text-muted);">${v.wordCount}字</span>
          </div>
      `;
      v.segments.forEach(seg => {
        html += `
          <div class="rewrite-segment">
            <div class="rewrite-seg-label">${seg.icon} ${seg.label}</div>
            <div class="rewrite-seg-content">${this.escapeHTML(seg.content)}</div>
          </div>
        `;
      });
      html += `
          <div class="rewrite-footer">
            <span class="rewrite-score ${v.antiAICheck.score >= 75 ? 'good' : 'warn'}">人感评分：${v.antiAICheck.score}/100 — ${v.antiAICheck.verdict}</span>
            <button class="copy-btn" onclick="App.copyVersion(${i})">📋 复制全文</button>
          </div>
        </div>
      `;
    });

    content.innerHTML = html;
    this._rewriteResult = result;
  },

  toneColor(tone) {
    return { aggressive: '#ee5a6f', gentle: '#a29bfe', professional: '#00d2a0' }[tone] || '#7c6cff';
  },
  copyVersion(i) {
    const v = this._rewriteResult.versions[i];
    const text = v.segments.map(s => `${s.icon} ${s.label}\n${s.content}`).join('\n\n') +
      `\n\n— ${v.toneEmoji} ${v.toneName} · 人感评分${v.antiAICheck.score}/100`;
    navigator.clipboard.writeText(text).then(() => this.toast('已复制到剪贴板'));
  },

  /* === 数据对比 === */
  showCompare() {
    this.switchView('compareView');
    this.updateNav('compare');
    this.renderCompare();
  },
  renderCompare() {
    const content = document.getElementById('compareContent');
    let html = `
      <div class="result-card">
        <div class="result-header"><h3>📊 同类爆款多平台数据对比</h3></div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">数据来源于新榜、蝉妈妈等第三方平台公开数据</div>
      </div>
    `;

    // 视频对比卡片
    COMPARISON_VIDEOS.forEach(v => {
      html += `<div class="compare-card"><div class="compare-title">${this.escapeHTML(v.title)}</div>`;
      html += '<div class="compare-platforms">';
      const platforms = Object.keys(v.platforms);
      platforms.forEach(pk => {
        const pd = v.platforms[pk];
        const pinfo = PLATFORMS[pk];
        if (!pinfo) return;
        const maxViews = Math.max(...platforms.map(p => v.platforms[p].views));
        html += `
          <div class="compare-platform">
            <div class="compare-platform-header"><span>${pinfo.icon}</span><span style="font-size:0.82rem;font-weight:600;">${pinfo.name}</span></div>
            <div class="compare-stat"><span class="text-muted">播放</span><span class="val">${this.formatNum(pd.views)}</span></div>
            <div class="compare-stat"><span class="text-muted">点赞</span><span class="val" style="color:var(--accent);">${this.formatNum(pd.likes)}</span></div>
            <div class="compare-stat"><span class="text-muted">评论</span><span class="val">${this.formatNum(pd.comments)}</span></div>
            <div class="compare-stat"><span class="text-muted">分享</span><span class="val">${this.formatNum(pd.shares)}</span></div>
            <div class="compare-stat"><span class="text-muted">完播率</span><span class="val">${this.formatPct(pd.completeRate)}</span></div>
            <div class="compare-complete-bar"><div class="compare-complete-fill" style="width:${pd.completeRate * 100}%;background:${pinfo.color};"></div></div>
          </div>
        `;
      });
      html += '</div></div>';
    });

    // 爆点效果对比表
    html += `
      <div class="result-card">
        <div class="result-header"><h3>🔬 爆点类型 × 平台传播效果</h3></div>
        <div style="overflow-x:auto;">
          <table class="effect-table">
            <thead><tr><th>爆点类型</th><th>抖音完播</th><th>快手完播</th><th>小红书完播</th><th>B站完播</th><th>视频号完播</th></tr></thead>
            <tbody>
    `;
    Object.entries(VIRAL_TYPE_PERFORMANCE).forEach(([key, data]) => {
      html += `<tr><td>${data.name}</td>`;
      ['douyin', 'kuaishou', 'xhs', 'bilibili', 'wechat'].forEach(pk => {
        const pd = data[pk];
        if (pd) {
          const w = Math.round(pd.avgCompleteRate * 80);
          html += `<td><div class="effect-bar" style="width:${w}px;background:${PLATFORMS[pk].color};"></div> ${this.formatPct(pd.avgCompleteRate)}</td>`;
        } else { html += '<td>-</td>'; }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">完播率越高，说明该爆点在该平台越有效</div>';
    html += '</div>';

    content.innerHTML = html;
  },

  /* === 热点趋势 === */
  showTrend() {
    this.switchView('trendView');
    this.updateNav('trend');
    this.renderTrend();
  },
  renderTrend() {
    const content = document.getElementById('trendContent');
    let html = `
      <div class="result-card">
        <div class="result-header"><h3>📈 本周热点趋势</h3></div>
        <div style="font-size:0.8rem;color:var(--text-muted);">更新时间：${TREND_DATA.lastUpdate} · ${TREND_DATA.dataSource}</div>
      </div>
    `;

    // 热词排行
    html += '<div class="trend-list">';
    TREND_DATA.weeklyHot.forEach(item => {
      const rankClass = item.rank <= 3 ? `r${item.rank}` : 'r4-plus';
      const pinfo = PLATFORMS[item.platform] || {};
      html += `
        <div class="trend-item">
          <div class="trend-rank ${rankClass}">${item.rank}</div>
          <div class="trend-info">
            <div class="trend-keyword">${this.escapeHTML(item.keyword)}</div>
            <div class="trend-meta">
              <span>${pinfo.icon || ''} ${pinfo.name || item.platform}</span>
              <span>均赞 ${this.formatNum(item.avgLikes)}</span>
              <span>${item.category}</span>
            </div>
          </div>
          <div class="trend-growth">${item.growth}</div>
        </div>
      `;
    });
    html += '</div>';

    // 平台趋势
    html += '<div class="result-card" style="margin-top:16px;"><div class="result-header"><h3>📊 各平台平均数据</h3></div></div>';
    Object.entries(TREND_DATA.platformTrends).forEach(([pk, data]) => {
      const pinfo = PLATFORMS[pk] || {};
      html += `
        <div class="trend-platform-card">
          <div class="trend-platform-header"><span style="font-size:1.2rem">${pinfo.icon}</span><span style="font-weight:600;">${pinfo.name}</span></div>
          <div class="trend-platform-stats">
            <div class="trend-stat"><div class="num">${this.formatNum(data.avgViews)}</div><div class="label">平均播放</div></div>
            <div class="trend-stat"><div class="num" style="color:var(--accent);">${this.formatNum(data.avgLikes)}</div><div class="label">平均点赞</div></div>
            <div class="trend-stat"><div class="num">${this.formatNum(data.avgComments)}</div><div class="label">平均评论</div></div>
          </div>
          <div class="trend-hot-cats">热门分类：${data.hotCategories.map(c => `<span class="trend-cat-tag">${this.escapeHTML(c)}</span>`).join('')}</div>
        </div>
      `;
    });

    html += `<div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:16px;">${TREND_DATA.updateNote}</div>`;
    content.innerHTML = html;
  },

  /* === 初始化 === */
  init() {
    this.loadExamples();
    this.setupDragDrop();
    // 注册service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  setupDragDrop() {
    const zone = document.getElementById('fileDropZone');
    if (!zone) return;
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        const input = document.getElementById('videoFileInput');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        this.onFileSelected(input);
      } else {
        this.toast('请拖入视频文件');
      }
    });
  },
};

App.init();
