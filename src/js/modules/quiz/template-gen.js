/**
 * PaperLens — Quiz Template Generator
 * Generates and validates the JSON question bank template format.
 */
export class TemplateGen {
  /**
   * Returns the example JSON template for a question bank.
   * @returns {Object} the template schema as a JS object
   */
  getTemplateSchema() {
    return {
      name: '示例题库',
      description: '这是一个题库模板示例',
      questions: [
        {
          id: 'q001',
          question: '以下哪个是 JavaScript 的基本数据类型？',
          options: [
            'Array',
            'String',
            'Object',
            'Function'
          ],
          answer: 1,
          explanation: 'String 是 JavaScript 的 7 种基本数据类型之一，其他基本类型包括 Number, Boolean, null, undefined, Symbol, BigInt。Array、Object、Function 都是引用类型。'
        },
        {
          id: 'q002',
          question: 'CSS 中，以下哪个属性用于设置文本颜色？',
          options: [
            'background-color',
            'font-size',
            'color',
            'text-align'
          ],
          answer: 2,
          explanation: 'color 属性用于设置文本的前景色（文字颜色）。'
        },
        {
          id: 'q003',
          question: '在 Git 中，将暂存区的修改提交到本地仓库的命令是？',
          options: [
            'git push',
            'git add',
            'git commit',
            'git merge'
          ],
          answer: 2,
          explanation: 'git commit 将暂存区（staging area）的修改提交到本地仓库。git add 是将文件添加到暂存区，git push 是推送到远程仓库。'
        },
        {
          id: 'q004',
          question: 'HTTP 状态码 404 表示什么？',
          options: [
            '服务器错误',
            '未授权访问',
            '资源未找到',
            '请求超时'
          ],
          answer: 2,
          explanation: '404 Not Found 表示服务器无法找到请求的资源。500 是服务器错误，401 是未授权，408 是请求超时。'
        }
      ]
    };
  }

  /**
   * Validate an array of question objects.
   * Checks required fields, answer index validity, option count, and duplicate IDs.
   *
   * @param {Array} questions — array of question objects to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateQuestions(questions) {
    const errors = [];

    if (!Array.isArray(questions)) {
      errors.push('题库数据必须是数组格式');
      return { valid: false, errors };
    }

    if (questions.length === 0) {
      errors.push('题库不能为空，至少需要 1 道题目');
      return { valid: false, errors };
    }

    const seenIds = new Set();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const prefix = `第 ${i + 1} 题`;

      // Check required fields
      if (!q.id) {
        errors.push(`${prefix}: 缺少 id 字段`);
      }

      if (!q.question) {
        errors.push(`${prefix}: 缺少 question 字段`);
      }

      if (!q.options) {
        errors.push(`${prefix}: 缺少 options 字段`);
      } else if (!Array.isArray(q.options)) {
        errors.push(`${prefix}: options 必须是数组`);
      } else {
        // Check exactly 4 options
        if (q.options.length !== 4) {
          errors.push(`${prefix}: options 必须恰好包含 4 个选项，当前有 ${q.options.length} 个`);
        }

        // Check for empty options
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j] || (typeof q.options[j] === 'string' && q.options[j].trim() === '')) {
            errors.push(`${prefix}: 选项 ${j + 1} 不能为空`);
          }
        }
      }

      if (q.answer === undefined || q.answer === null) {
        errors.push(`${prefix}: 缺少 answer 字段`);
      } else {
        // Check answer is a valid index (0-3)
        if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) {
          errors.push(`${prefix}: answer 必须是整数`);
        } else if (q.answer < 0 || q.answer > 3) {
          errors.push(`${prefix}: answer 必须在 0-3 之间，当前值为 ${q.answer}`);
        } else if (q.options && Array.isArray(q.options) && q.answer >= q.options.length) {
          errors.push(`${prefix}: answer 索引 ${q.answer} 超出选项范围（选项数量: ${q.options.length}）`);
        }
      }

      // Check explanation (warning only, not blocking)
      if (!q.explanation) {
        // This is a non-blocking warning — we note it but don't mark invalid
        // errors.push(`${prefix}: 缺少 explanation 字段（建议填写）`);
      }

      // Check duplicate IDs
      if (q.id) {
        if (seenIds.has(q.id)) {
          errors.push(`${prefix}: id "${q.id}" 重复`);
        } else {
          seenIds.add(q.id);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single question object.
   * @param {Object} question
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateSingleQuestion(question) {
    return this.validateQuestions([question]);
  }
}
