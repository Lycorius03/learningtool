/**
 * PaperLens — Exporter
 * Exports annotations to Markdown or JSON.
 * Supports client-side file download via Blob and server-side export via API.
 */
export class Exporter {
  /**
   * Export annotations to a formatted Markdown string.
   * @param {Array}  annotations - Array of annotation objects
   * @param {string} title       - Document title
   * @returns {string} Markdown string
   */
  exportMD(annotations, title = '未命名文档') {
    const lines = [];

    lines.push(`# ${title} — 注释导出`);
    lines.push('');
    lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`);
    lines.push(`> 注释数量：${annotations.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (annotations.length === 0) {
      lines.push('*暂无注释*');
      return lines.join('\n');
    }

    const highlights = annotations.filter(a => a.type === 'highlight');
    const notes      = annotations.filter(a => a.type === 'note');

    if (highlights.length > 0) {
      lines.push('## 高亮标记');
      lines.push('');

      highlights.forEach((ann, i) => {
        lines.push(`### ${i + 1}. 高亮`);
        lines.push('');
        lines.push(`> ${ann.text.replace(/\n/g, '\n> ')}`);
        lines.push('');
        lines.push(`- 位置：${ann.position.start} – ${ann.position.end}`);
        lines.push(`- 时间：${new Date(ann.timestamp).toLocaleString('zh-CN')}`);
        lines.push('');
      });
    }

    if (notes.length > 0) {
      lines.push('## 笔记');
      lines.push('');

      notes.forEach((ann, i) => {
        lines.push(`### ${i + 1}. 笔记`);
        lines.push('');
        lines.push('**原文：**');
        lines.push(`> ${ann.text.replace(/\n/g, '\n> ')}`);
        lines.push('');
        lines.push('**笔记：**');
        lines.push(ann.note || '*无内容*');
        lines.push('');
        lines.push(`- 位置：${ann.position.start} – ${ann.position.end}`);
        lines.push(`- 时间：${new Date(ann.timestamp).toLocaleString('zh-CN')}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
    lines.push('*由 PaperLens 生成*');

    return lines.join('\n');
  }

  /**
   * Export annotations to a pretty-printed JSON string.
   * @param {Array} annotations - Array of annotation objects
   * @returns {string} JSON string
   */
  exportJSON(annotations) {
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalCount: annotations.length,
      annotations: annotations.map(ann => ({
        id: ann.id,
        type: ann.type,
        text: ann.text,
        note: ann.note || null,
        position: ann.position,
        timestamp: ann.timestamp
      }))
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Trigger a browser file download using Blob and URL.createObjectURL.
   * @param {string} content  - File content
   * @param {string} filename - Suggested filename
   * @param {string} [type='text/plain'] - MIME type
   */
  downloadAsFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url  = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Send annotations to the server for persistent export.
   * @param {Array}  annotations
   * @param {string} title
   * @returns {Promise<object>} Server response JSON
   */
  async serverExport(annotations, title) {
    const resp = await fetch('/api/files/export-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        annotations,
        exportedAt: new Date().toISOString()
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || '服务器导出失败');
    }

    return resp.json();
  }
}
