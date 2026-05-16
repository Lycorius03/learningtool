/**
 * LearningTool — AI Engine Service (Frontend)
 * Handles communication with backend AI proxy.
 * Supports user-configured provider models with encrypted key storage.
 */
import { decryptApiKey, getDevicePassword } from '../utils/crypto.js';

export class AIEngine {
  constructor(state) {
    this.state = state;
    this._providerConfig = null;
    this._decryptedCache = null;
    this._modelsHash = null;
  }

  /**
   * Get the active provider config from user's saved models.
   * Decrypts the stored API key before returning.
   * Caches result keyed by a hash of the models config for invalidation.
   */
  async _getProviderConfig() {
    try {
      const modelsRaw = localStorage.getItem('paperlens_models');
      const modelsHash = modelsRaw ? this._hashString(modelsRaw) : 'empty';

      // Return cached config if models haven't changed
      if (this._decryptedCache && this._modelsHash === modelsHash) return this._decryptedCache;

      const models = JSON.parse(modelsRaw || '[]');
      const model = models.find(m => m.default) || models[0];
      if (!model || !model.apiKey) {
        this._decryptedCache = null;
        this._modelsHash = null;
        return null;
      }

      let apiKey = model.apiKey;
      // Attempt decryption — if it fails, the stored value may be plaintext
      // (legacy storage or manual entry). If it IS ciphertext that we can't
      // decrypt (e.g. browser fingerprint changed), apiKey stays as the
      // base64 ciphertext — which will fail on the API call with a clear
      // error, rather than silently succeeding with wrong data.
      try {
        apiKey = await decryptApiKey(model.apiKey, getDevicePassword());
      } catch (e) {
        // If the stored value looks like a base64 ciphertext (long, no whitespace),
        // warn the user — decryption likely failed due to changed device fingerprint
        if (model.apiKey.length > 64 && /^[A-Za-z0-9+/=]+$/.test(model.apiKey)) {
          console.warn('[AI-Engine] Decryption failed — stored value appears to be encrypted ciphertext. Key will not work.');
          this._decryptedCache = null;
          this._modelsHash = null;
          return null;
        }
        console.log('[AI-Engine] Using plaintext API key (decryption skipped)');
      }

      this._decryptedCache = {
        provider: model.provider,
        apiKey,
        baseUrl: model.baseUrl,
        model: model.model
      };
      this._modelsHash = modelsHash;
      return this._decryptedCache;
    } catch (e) {
      console.warn('[AI-Engine] Failed to load provider config:', e);
      return null;
    }
  }

  /** Clear cached decrypted key (called when models are updated in settings) */
  clearCache() {
    this._decryptedCache = null;
    this._modelsHash = null;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString(36);
  }

  async generate(prompt, context = '你是一个学术论文辅助阅读AI。请用中文回答，语言清晰、准确。') {
    const body = { prompt, context, model: 'deepseek-v4-pro' };
    const providerConfig = await this._getProviderConfig();
    if (providerConfig) body.providerConfig = providerConfig;

    const resp = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (resp.status === 403) {
      throw new Error('需要管理员权限或配置自己的 API Key。请在设置中添加模型。');
    }
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'AI请求失败');
    }
    return resp.json();
  }

  async *chat(messages) {
    const body = { messages, model: 'deepseek-v4-flash' };
    const providerConfig = await this._getProviderConfig();
    if (providerConfig) body.providerConfig = providerConfig;

    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (resp.status === 403) {
      throw new Error('需要管理员权限或配置自己的 API Key。请在设置中添加模型。');
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'AI请求失败');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try { const p = JSON.parse(data); if (p.content) yield p; } catch (e) { /* skip */ }
        }
      }
    }
  }
}
