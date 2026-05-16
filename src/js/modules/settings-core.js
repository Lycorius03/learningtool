import { showToast } from '../utils/toast.js';
import { encryptApiKey, getDevicePassword } from '../utils/crypto.js';

export class SettingsCore {
  constructor(state) {
    document.addEventListener('page-loaded', e => {
      if (e.detail.route === 'settings') this._init(e.detail.state);
    });
  }

  _init(state) {
    // Save buttons: DeepSeek, OpenAI, Anthropic
    ['DeepSeek','OpenAI','Anthropic'].forEach(provider => {
      const save = document.getElementById(`apiKey${provider}Save`);
      const input = document.getElementById(`apiKey${provider}`);
      const status = document.getElementById(`${provider === 'DeepSeek' ? 'ds' : provider === 'OpenAI' ? 'oa' : 'an'}Status`);
      const statusEmpty = document.getElementById(`${provider === 'DeepSeek' ? 'ds' : provider === 'OpenAI' ? 'oa' : 'an'}StatusEmpty`);

      if (save && input) {
        save.addEventListener('click', async () => {
          const key = input.value.trim();
          if (!key) { showToast('请输入 API Key', 'warning'); return; }
          try {
            const enc = await encryptApiKey(key, getDevicePassword());
            state.setUserApiKey(provider.toLowerCase(), enc);
            if (status) status.style.display = 'inline-flex';
            if (statusEmpty) statusEmpty.style.display = 'none';
            showToast('API Key saved', 'success');
          } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
          }
        });

        // Toggle visibility
        const toggle = document.getElementById(`apiKey${provider}Toggle`);
        if (toggle) toggle.addEventListener('click', () => {
          input.type = input.type === 'password' ? 'text' : 'password';
        });

        // Load existing
        if (state.getUserApiKey(provider.toLowerCase())) {
          if (status) status.style.display = 'inline-flex';
          if (statusEmpty) statusEmpty.style.display = 'none';
        }
      }
    });

    // MFAW params save
    const paramSave = document.getElementById('paramSave');
    paramSave?.addEventListener('click', () => {
      const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
      const params = {
        alpha: getVal('paramAlpha'), beta: getVal('paramBeta'),
        gamma: getVal('paramGamma'), delta: getVal('paramDelta'),
        emaRate: getVal('paramEmaRate'), lambda: getVal('paramLambda')
      };
      state.updateSettings({ mfawParams: params });
      showToast('Parameters saved', 'success');
    });

    // Populate saved MFAW params from state
    const savedParams = state.settings?.mfawParams || {};
    const defaults = { paramAlpha: 2.0, paramBeta: 0.5, paramGamma: 0.3, paramDelta: 0.15, paramEmaRate: 0.2, paramLambda: 1.0 };
    const paramMap = { alpha: 'paramAlpha', beta: 'paramBeta', gamma: 'paramGamma', delta: 'paramDelta', emaRate: 'paramEmaRate', lambda: 'paramLambda' };
    Object.entries(paramMap).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = savedParams[key] ?? defaults[id];
    });

    // Reset defaults
    const resetBtn = document.getElementById('paramResetDefault');
    resetBtn?.addEventListener('click', () => {
      const defaults = { paramAlpha: 2.0, paramBeta: 0.5, paramGamma: 0.3, paramDelta: 0.15, paramEmaRate: 0.2, paramLambda: 1.0 };
      Object.entries(defaults).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      showToast('Reset to defaults', 'info');
    });
  }
}

new SettingsCore(null);
