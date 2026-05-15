/**
 * PaperLens — Frontend File Parser Service
 * Reads and parses uploaded files. Delegates PDF/DOCX to server-side parser.
 */
export class FileParser {
  constructor() {
    this.supportedTypes = ['txt', 'md', 'json'];
    this.serverTypes = ['pdf', 'docx'];
    this.maxFileSize = 10 * 1024 * 1024; // 10 MB
  }

  /**
   * Parse a File object and return its text content.
   * For .txt, .md, .json — reads on the client.
   * For .pdf, .docx — uploads to /api/files/upload for server-side parsing.
   *
   * @param {File} file — browser File object
   * @returns {Promise<{ text: string, type: string, name: string, size: number }>}
   */
  async parseFile(file) {
    if (!file) {
      throw new Error('未提供文件');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 10MB`);
    }

    const name = file.name || 'unknown';
    const extension = this._getExtension(name).toLowerCase();
    const type = extension;

    if (this.supportedTypes.includes(extension)) {
      const text = await this._readAsText(file);
      return { text, type, name, size: file.size };
    }

    if (this.serverTypes.includes(extension)) {
      const text = await this._serverParse(file);
      return { text, type, name, size: file.size };
    }

    // Try reading as text for unknown extensions
    const text = await this._readAsText(file);
    return { text, type: extension || 'unknown', name, size: file.size };
  }

  /**
   * Parse multiple files in parallel.
   * @param {File[]} files
   * @returns {Promise<Array<{ text: string, type: string, name: string, size: number }>>}
   */
  async parseFiles(files) {
    const results = await Promise.allSettled(
      Array.from(files).map(f => this.parseFile(f))
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        text: '',
        type: 'error',
        name: files[i].name,
        size: files[i].size,
        error: r.reason.message || '解析失败'
      };
    });
  }

  /**
   * Check whether a file type is supported.
   */
  isSupported(file) {
    const ext = this._getExtension(file.name).toLowerCase();
    return this.supportedTypes.includes(ext) || this.serverTypes.includes(ext);
  }

  /**
   * Get the list of all supported extensions.
   */
  getSupportedExtensions() {
    return [...this.supportedTypes, ...this.serverTypes];
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  async _serverParse(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `服务器解析失败 (HTTP ${response.status})`);
      }

      const data = await response.json();
      return data.text || data.content || '';
    } catch (err) {
      if (err.message.includes('服务器解析失败')) throw err;
      throw new Error(`文件上传失败: ${err.message}`);
    }
  }

  _getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() : '';
  }
}
