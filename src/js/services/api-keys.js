/**
 * PaperLens — API Key Management Service
 * Encrypts and stores user API keys in localStorage using AES-GCM via Web Crypto API.
 * Keys are stored under 'paperlens_keys' as a JSON object:
 *   { [provider]: { encrypted: "<base64-ciphertext>", createdAt: "<iso-timestamp>" } }
 */
import { encryptApiKey, decryptApiKey, getDevicePassword } from '../utils/crypto.js';

const STORAGE_KEY = 'paperlens_keys';

class ApiKeyService {
  constructor() {
    this._cache = {};  // Decrypted keys cached in memory (cleared on reload)
  }

  /**
   * Encrypt and save an API key for a given provider.
   * @param {string} provider — provider name (e.g., 'deepseek', 'openai', 'siliconflow')
   * @param {string} key — the plaintext API key
   * @param {string} [password] — encryption password, defaults to device password
   * @returns {Promise<{ success: boolean, provider: string }>}
   */
  async saveKey(provider, key, password) {
    if (!provider || typeof provider !== 'string') {
      throw new Error('provider 不能为空');
    }
    if (!key || typeof key !== 'string') {
      throw new Error('API key 不能为空');
    }

    const pass = password || getDevicePassword();
    const encrypted = await encryptApiKey(key, pass);

    const allKeys = this._loadAll();
    allKeys[provider] = {
      encrypted,
      createdAt: new Date().toISOString()
    };

    this._saveAll(allKeys);

    // Cache the decrypted key
    this._cache[provider] = key;

    return { success: true, provider };
  }

  /**
   * Decrypt and return an API key for a given provider.
   * Returns the cached value if already decrypted in this session.
   *
   * @param {string} provider — provider name
   * @param {string} [password] — encryption password, defaults to device password
   * @returns {Promise<string>} the decrypted API key
   */
  async loadKey(provider, password) {
    if (!provider || typeof provider !== 'string') {
      throw new Error('provider 不能为空');
    }

    // Return cached key if available
    if (this._cache[provider] !== undefined) {
      return this._cache[provider];
    }

    const allKeys = this._loadAll();
    const entry = allKeys[provider];

    if (!entry || !entry.encrypted) {
      throw new Error(`未找到 ${provider} 的 API Key`);
    }

    const pass = password || getDevicePassword();

    try {
      const decrypted = await decryptApiKey(entry.encrypted, pass);
      this._cache[provider] = decrypted;
      return decrypted;
    } catch (e) {
      throw new Error(`解密 ${provider} 的 API Key 失败: ${e.message}`);
    }
  }

  /**
   * Delete a stored API key for a provider.
   * @param {string} provider
   * @returns {{ success: boolean, provider: string }}
   */
  deleteKey(provider) {
    if (!provider || typeof provider !== 'string') {
      throw new Error('provider 不能为空');
    }

    const allKeys = this._loadAll();

    if (!allKeys[provider]) {
      return { success: false, provider, reason: 'not_found' };
    }

    delete allKeys[provider];
    this._saveAll(allKeys);

    // Clear from cache
    delete this._cache[provider];

    return { success: true, provider };
  }

  /**
   * List all providers with stored API keys.
   * @returns {Array<{ provider: string, createdAt: string }>}
   */
  listProviders() {
    const allKeys = this._loadAll();
    return Object.entries(allKeys).map(([provider, entry]) => ({
      provider,
      createdAt: entry.createdAt || 'unknown'
    }));
  }

  /**
   * Check if a key exists for the given provider.
   * @param {string} provider
   * @returns {boolean}
   */
  hasKey(provider) {
    if (!provider) return false;
    const allKeys = this._loadAll();
    return !!allKeys[provider];
  }

  /**
   * Delete all stored API keys.
   */
  clearAll() {
    this._cache = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Check whether a cached (in-memory) copy is available for the given provider.
   * @param {string} provider
   * @returns {boolean}
   */
  isCached(provider) {
    return this._cache[provider] !== undefined;
  }

  /**
   * Clear only the in-memory cache (keys remain in localStorage).
   * Useful when the user wants to require re-authentication.
   */
  clearCache() {
    this._cache = {};
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.warn('ApiKeyService: failed to load keys from localStorage', e);
      return {};
    }
  }

  _saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('ApiKeyService: failed to save keys to localStorage', e);
      throw new Error('保存 API Key 失败：本地存储空间不足');
    }
  }
}

// Singleton export
export const apiKeys = new ApiKeyService();
export default apiKeys;
