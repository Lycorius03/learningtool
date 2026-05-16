import { showToast } from '../utils/toast.js';
import { encryptApiKey, getDevicePassword } from '../utils/crypto.js';

export class SettingsCore {
  constructor(state) {
    this.state = state;
    document.addEventListener('page-loaded', e => {
      if (e.detail.route === 'settings') this._init(e.detail.state);
    });
  }

  _init(state) {
    this.state = state;

    // Render existing models
    this._renderModelList();

    // Add model button → open modal
    document.getElementById('addModelBtn')?.addEventListener('click', () => this._openAddModal());

    // Modal: cancel
    document.getElementById('addModelCancel')?.addEventListener('click', () => this._closeAddModal());

    // Modal: save
    document.getElementById('addModelSave')?.addEventListener('click', () => this._saveModel());

    // Modal: test connection
    document.getElementById('testConnBtn')?.addEventListener('click', () => this._testConnection());

    // Modal: toggle API key visibility
    document.getElementById('newApiKeyToggle')?.addEventListener('click', () => {
      const input = document.getElementById('newApiKey');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Close modal on overlay click
    document.getElementById('addModelModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this._closeAddModal();
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeAddModal();
    });

    // MFAW params
    this._initMfawParams(state);

    // Theme toggle
    this._initThemeToggle();

    // Data management
    this._initDataManagement();
  }

  // ==================== Data Management ====================

  _initDataManagement() {
    // Export
    document.getElementById('exportDataBtn')?.addEventListener('click', () => this._exportData());

    // Import
    const importInput = document.getElementById('importDataInput');
    document.getElementById('importDataBtn')?.addEventListener('click', () => {
      if (importInput) importInput.click();
    });
    importInput?.addEventListener('change', (e) => {
      if (e.target.files.length) this._importData(e.target.files[0]);
    });

    // Clear all
    document.getElementById('clearDataBtn')?.addEventListener('click', () => this._clearAllData());
  }

  _exportData() {
    try {
      const backup = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        state: JSON.parse(localStorage.getItem('paperlens_state') || '{}'),
        models: JSON.parse(localStorage.getItem('paperlens_models') || '[]'),
        visits: JSON.parse(localStorage.getItem('paperlens_visits') || '[]'),
        theme: localStorage.getItem('paperlens_theme') || 'light'
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learningtool-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('数据已导出', 'success');
    } catch (err) {
      showToast('导出失败: ' + err.message, 'error');
    }
  }

  _importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup.version && !backup.state && !backup.models) {
          showToast('无效的备份文件格式', 'error');
          return;
        }

        // Restore data
        if (backup.state) localStorage.setItem('paperlens_state', JSON.stringify(backup.state));
        if (backup.models) localStorage.setItem('paperlens_models', JSON.stringify(backup.models));
        if (backup.visits) localStorage.setItem('paperlens_visits', JSON.stringify(backup.visits));
        if (backup.theme) localStorage.setItem('paperlens_theme', backup.theme);

        // Reload state into AppState
        if (this.state && this.state.loadFromStorage) {
          this.state.loadFromStorage();
        }

        // Re-render models list
        this._renderModelList();

        showToast('数据已恢复，请刷新页面以应用所有更改', 'success');
      } catch (err) {
        showToast('导入失败: 文件格式错误', 'error');
      }
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file);
  }

  _clearAllData() {
    if (!confirm('确定要清除所有数据吗？\n\n此操作将删除：\n• 题库进度\n• 论文列表\n• AI 模型配置\n• 设置偏好\n\n建议先导出备份。此操作不可撤销。')) return;

    const keys = [
      'paperlens_state',
      'paperlens_models',
      'paperlens_visits',
      'paperlens_theme',
      'paperlens_keys',
      'paperlens_quiz_progress',
      'paperlens_papers',
      'paperlens_settings'
    ];

    keys.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    });

    // Reload state
    if (this.state) {
      this.state.papers = [];
      this.state.quizProgress = {};
      this.state.userApiKeys = {};
      this.state.settings = { quizMode: 'weighted-random', questionsPerRound: 20, autoRemoveErrorBook: true, wrongRepeat: true };
      this.state.saveToStorage();
    }

    showToast('所有数据已清除', 'info');
    this._renderModelList();
  }

  // ==================== Model Management ====================

  _getModels() {
    try {
      return JSON.parse(localStorage.getItem('paperlens_models') || '[]');
    } catch (e) { return []; }
  }

  _saveModels(models) {
    localStorage.setItem('paperlens_models', JSON.stringify(models));
  }

  _renderModelList() {
    const list = document.getElementById('modelList');
    const empty = document.getElementById('modelListEmpty');
    const models = this._getModels();

    if (!list) return;

    // Clear existing cards (keep empty state)
    list.querySelectorAll('.model-card').forEach(c => c.remove());

    if (models.length === 0) {
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    models.forEach((m, idx) => {
      const card = document.createElement('div');
      card.className = 'card model-card';
      card.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

      const maskedKey = m.apiKey ? '已设置' : '未配置';

      card.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:4px;">
            <span style="font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--color-text-primary);">${this._esc(m.provider)}</span>
            <span class="badge badge-accent">${this._esc(m.model)}</span>
            ${m.verified ? '<span class="badge badge-success">'+(window.__t?window.__t('settings.verified','Verified'):'Verified')+'</span>' : '<span class="badge badge-default">'+(window.__t?window.__t('settings.unverified','Unverified'):'Unverified')+'</span>'}
          </div>
          <div style="font-size:var(--text-xs); color:var(--color-text-tertiary);">
            <span>${this._esc(m.baseUrl)}</span>
            <span style="margin-left:var(--space-2);">Key: ${maskedKey}</span>
          </div>
        </div>
        <div style="display:flex; gap:var(--space-2); flex-shrink:0;">
          <button class="btn btn-ghost btn-sm model-set-default" data-idx="${idx}" title="${window.__t?window.__t('settings.setDefault','Set as default'):'Set as default'}">
            ${m.default ? '<span class="badge badge-success" style="font-size:10px;">'+(window.__t?window.__t('settings.default','Default'):'Default')+'</span>' : (window.__t?window.__t('settings.setDefault','Set as default'):'Set as default')}
          </button>
          <button class="btn btn-ghost btn-sm model-delete" data-idx="${idx}" title="${window.__t?window.__t('settings.delete','Delete'):'Delete'}" style="color:var(--color-error);">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12l-1 10H3L2 4zM6 2h4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `;

      list.appendChild(card);
    });

    // Wire up buttons
    list.querySelectorAll('.model-set-default').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const models = this._getModels();
        models.forEach((m, i) => m.default = (i === idx));
        this._saveModels(models);
        this._renderModelList();
        showToast('已设置默认模型', 'success');
      });
    });

    list.querySelectorAll('.model-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const models = this._getModels();
        const removed = models.splice(idx, 1)[0];
        this._saveModels(models);
        this._renderModelList();
        showToast(`已删除 ${removed.provider}`, 'info');
      });
    });
  }

  _openAddModal() {
    const modal = document.getElementById('addModelModal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Clear form
    ['newProviderName', 'newApiKey', 'newBaseUrl', 'newModelName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const result = document.getElementById('testResult');
    if (result) result.innerHTML = '';
    const datalist = document.getElementById('availableModelsList');
    if (datalist) datalist.innerHTML = '';

    // Populate provider presets
    this._populateProviderPresets();
    // Wire provider name → auto-fill URL
    this._wireProviderAutofill();
  }

  _populateProviderPresets() {
    const datalist = document.getElementById('providerPresets');
    if (!datalist) return;
    datalist.innerHTML = this._getProviderPresets().map(p =>
      `<option value="${p.name}">${p.name} — ${p.baseUrl}</option>`
    ).join('');
  }

  _getProviderPresets() {
    return [
      { name: 'OpenAI', baseUrl: 'https://api.openai.com' },
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
      { name: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com' },
      { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com' },
      { name: 'Groq', baseUrl: 'https://api.groq.com/openai' },
      { name: 'Together AI', baseUrl: 'https://api.together.xyz' },
      { name: '硅基流动 (SiliconFlow)', baseUrl: 'https://api.siliconflow.cn' },
      { name: '零一万物 (Yi)', baseUrl: 'https://api.lingyiwanwu.com' },
      { name: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn' },
      { name: 'MiniMax', baseUrl: 'https://api.minimax.chat' },
      { name: 'Qwen (通义千问)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode' },
      { name: 'DeepSeek (硅基流动)', baseUrl: 'https://api.siliconflow.cn' },
      { name: 'Zhipu (智谱)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      { name: 'Ollama (本地)', baseUrl: 'http://localhost:11434' },
      { name: 'vLLM (本地)', baseUrl: 'http://localhost:8000' },
      { name: 'Custom (自定义)', baseUrl: '' }
    ];
  }

  _wireProviderAutofill() {
    const providerInput = document.getElementById('newProviderName');
    const baseUrlInput = document.getElementById('newBaseUrl');
    if (!providerInput || !baseUrlInput) return;

    providerInput.addEventListener('input', () => {
      const name = providerInput.value.trim();
      const presets = this._getProviderPresets();
      const match = presets.find(p => p.name === name || p.name.startsWith(name));
      if (match && match.baseUrl) {
        baseUrlInput.value = match.baseUrl;
      }
    });

    // Also on blur (when user picks from dropdown)
    providerInput.addEventListener('change', () => {
      const name = providerInput.value.trim();
      const presets = this._getProviderPresets();
      const match = presets.find(p => p.name === name);
      if (match && match.baseUrl) {
        baseUrlInput.value = match.baseUrl;
      }
    });
  }

  _closeAddModal() {
    const modal = document.getElementById('addModelModal');
    if (modal) modal.style.display = 'none';
  }

  async _testConnection() {
    const provider = document.getElementById('newProviderName')?.value.trim() || 'Custom';
    const apiKey = document.getElementById('newApiKey')?.value.trim();
    const baseUrl = document.getElementById('newBaseUrl')?.value.trim();
    const modelName = document.getElementById('newModelName')?.value.trim();
    const resultEl = document.getElementById('testResult');

    if (!apiKey) {
      if (resultEl) resultEl.innerHTML = '<span style="color:var(--color-error);">请先填写 API 密钥</span>';
      return;
    }
    if (!baseUrl) {
      if (resultEl) resultEl.innerHTML = '<span style="color:var(--color-error);">请先填写请求地址</span>';
      return;
    }
    if (!modelName) {
      if (resultEl) resultEl.innerHTML = '<span style="color:var(--color-error);">请先填写模型名称</span>';
      return;
    }

    if (resultEl) resultEl.innerHTML = '<span style="color:var(--color-info);">正在测试连接...</span>';

    try {
      const resp = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerConfig: { provider, apiKey, baseUrl, model: modelName }
        })
      });

      const data = await resp.json();

      if (data.success) {
        if (resultEl) resultEl.innerHTML = `<span style="color:var(--color-success);">连接成功！模型: ${data.model}</span>`;

        // Populate available models datalist and auto-fill model input
        if (data.models && data.models.length > 0) {
          const datalist = document.getElementById('availableModelsList');
          if (datalist) {
            datalist.innerHTML = data.models.map(m => `<option value="${m}">`).join('');
          }
          // Auto-fill model name with the currently used model
          const modelInput = document.getElementById('newModelName');
          if (modelInput && data.model) {
            modelInput.value = data.model;
          }
          if (resultEl) resultEl.innerHTML += `<br><span style="color:var(--color-text-tertiary);">可用模型 (${data.models.length}): ${data.models.slice(0, 20).join(', ')}${data.models.length > 20 ? '...' : ''}</span>`;
        }
      } else {
        if (resultEl) resultEl.innerHTML = `<span style="color:var(--color-error);">连接失败: ${data.error || '未知错误'}</span>`;
      }
    } catch (err) {
      if (resultEl) resultEl.innerHTML = `<span style="color:var(--color-error);">测试失败: ${err.message}</span>`;
    }
  }

  async _saveModel() {
    const provider = document.getElementById('newProviderName')?.value.trim();
    const apiKey = document.getElementById('newApiKey')?.value.trim();
    const baseUrl = document.getElementById('newBaseUrl')?.value.trim();
    const model = document.getElementById('newModelName')?.value.trim();

    if (!provider) { showToast('请输入服务商名称', 'warning'); return; }
    if (!apiKey) { showToast('请输入 API 密钥', 'warning'); return; }
    if (!baseUrl) { showToast('请输入请求地址', 'warning'); return; }
    if (!model) { showToast('请输入模型名称', 'warning'); return; }

    // Encrypt API key before storing
    let encryptedKey;
    try {
      encryptedKey = await encryptApiKey(apiKey, getDevicePassword());
    } catch (e) {
      encryptedKey = apiKey; // Fallback: store as-is
    }

    const models = this._getModels();

    // Check for duplicate
    const dup = models.find(m => m.provider === provider && m.model === model);
    if (dup) {
      showToast('该服务商和模型已存在', 'warning');
      return;
    }

    // First model added = default
    const isDefault = models.length === 0;

    models.push({
      id: Date.now().toString(36),
      provider,
      apiKey: encryptedKey,
      baseUrl,
      model,
      verified: false,
      default: isDefault,
      addedAt: new Date().toISOString()
    });

    this._saveModels(models);
    this._renderModelList();
    this._closeAddModal();
    showToast(`已添加 ${provider}/${model}`, 'success');
  }

  // ==================== MFAW Params ====================

  _initMfawParams(state) {
    const paramSave = document.getElementById('paramSave');
    paramSave?.addEventListener('click', () => {
      const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
      const params = {
        alpha: getVal('paramAlpha'), beta: getVal('paramBeta'),
        gamma: getVal('paramGamma'), delta: getVal('paramDelta'),
        emaRate: getVal('paramEmaRate'), lambda: getVal('paramLambda')
      };
      state.updateSettings({ mfawParams: params });
      showToast('参数已保存', 'success');
    });

    const savedParams = state.settings?.mfawParams || {};
    const defaults = { paramAlpha: 2.0, paramBeta: 0.5, paramGamma: 0.3, paramDelta: 0.15, paramEmaRate: 0.2, paramLambda: 1.0 };
    const paramMap = { alpha: 'paramAlpha', beta: 'paramBeta', gamma: 'paramGamma', delta: 'paramDelta', emaRate: 'paramEmaRate', lambda: 'paramLambda' };
    Object.entries(paramMap).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = savedParams[key] ?? defaults[id];
    });

    document.getElementById('paramResetDefault')?.addEventListener('click', () => {
      const defaults = { paramAlpha: 2.0, paramBeta: 0.5, paramGamma: 0.3, paramDelta: 0.15, paramEmaRate: 0.2, paramLambda: 1.0 };
      Object.entries(defaults).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      showToast('已恢复默认值', 'info');
    });
  }

  // ==================== Theme ====================

  _initThemeToggle() {
    const themeLight = document.getElementById('themeLight');
    const themeDark = document.getElementById('themeDark');
    if (!themeLight || !themeDark) return;

    const setTheme = (theme) => {
      const isDark = theme === 'dark';
      // Add transition class for smooth color change
      document.documentElement.classList.add('theme-transition');
      document.documentElement.classList.toggle('dark', isDark);
      themeLight.style.opacity = isDark ? '0.5' : '1';
      themeDark.style.opacity = isDark ? '1' : '0.5';
      try { localStorage.setItem('paperlens_theme', theme); } catch (e) { /* ignore */ }
      // Remove transition class after animation completes
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 500);
    };

    themeLight.addEventListener('click', () => setTheme('light'));
    themeDark.addEventListener('click', () => setTheme('dark'));

    // Load saved theme
    try {
      const saved = localStorage.getItem('paperlens_theme');
      if (saved === 'dark') setTheme('dark');
      else setTheme('light'); // Default light
    } catch (e) { setTheme('light'); }
  }

  _esc(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
}

new SettingsCore();
