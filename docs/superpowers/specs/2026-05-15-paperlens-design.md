# PaperLens — 设计文档

**日期：** 2026-05-15
**状态：** 已确认

## 概述

PaperLens 是一个模块化动态网页应用，提供论文阅读辅助和智能刷题两大核心功能。采用 Claude 古典美学设计风格，支持 Windows/Linux 跨平台运行，内置一键容器化和打包脚本。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | 原生 HTML/CSS/JS (ES Modules) | 零框架、零构建步骤、极致轻量 |
| 后端 | Node.js 20 + Express | REST API + SSE 流式响应 |
| 美学 | Claude Design System | DM Sans 字体、暖色调、cubic-bezier 动效 |
| 容器化 | Docker + Docker Compose | Linux/WSL2 一键部署 |
| 打包 | tar.gz 便携包 | 跨机器迁移 |

## 子系统

### 1. 论文阅读模块 (`src/js/modules/paper-reader/`)

- 支持 PDF、DOCX、TXT、MD 格式导入
- 左面板渲染原文，右面板展示 AI 解释/Chat
- Tab 键一键切换焦点（原文 ↔ 解释面板）
- 文本勾画（高亮、下划线）和笔记批注
- 标注内容一键导出（MD/JSON/PDF）

### 2. 刷题模块 (`src/js/modules/quiz/`)

- 导入格式：JSON（专用模板）、Word、MD、PDF（AI 解析）
- 仅支持选择题，JSON 模板含选项和解析
- 三种模式：
  - **顺序刷题**：按导入顺序依次展示
  - **加权乱序**：MFAW 多因子自适应权重算法，Alias Method O(1) 采样
  - **错题本**：答错即进入，掌握后自动移除（用户可选）
- 权重算法：MFAW = α·PF + β·DF + γ·(1−SF) + δ·NF
  - PF: 指数移动平均跟踪近期表现
  - DF: 题目固有难度（基于全体历史）
  - SF: 连续答对稳定性
  - NF: 基于遗忘曲线的时间衰减

### 3. AI 引擎层 (`src/js/services/` + `server/services/`)

- 用户可导入各厂商 API Key，AES 加密存于 localStorage
- 管理员（Echo / 0x2A.p4）预配 DeepSeek API Key
- 支持 DeepSeek-v4-flash[1m] 和 DeepSeek-v4-pro[1m]
- 所有 AI 请求走后端代理，Key 永不过浏览器网络
- 双通道验证流水线（严格模式）：
  - Channel 1: AI 生成 → 写入后台文件
  - Channel 2: AI 独立审阅 → 事实/逻辑/格式检查
  - 通过才返回用户，最多重试 2 次

### 4. 核心 Shell (`src/css/` + `src/js/app.js`)

- Claude 风格侧边栏（260px）+ 白色主内容区
- SPA 路由管理（hash-based）
- 全局状态管理 + 事件总线
- 动效系统：cubic-bezier(0.16, 1, 0.3, 1)，120-500ms

## 安全设计

- **API Key**: 用户 Key 经 AES 加密存 localStorage；管理员 Key 存 .env（gitignored）
- **管理员入口**: Ctrl+Shift+Alt+E 键盘和弦 + `/admin` URL 路径双入口
- **登录保护**: httpOnly session cookie，5 次失败 IP 锁定 15 分钟
- **文件上传**: 类型白名单（pdf/docx/txt/md/json），大小限制 50MB

## 路由设计

| 路由 | 页面 |
|---|---|
| `#/home` | 欢迎页（功能卡片 + suggestion chips） |
| `#/reader` | 论文阅读（文件导入 + 分屏视图） |
| `#/reader/:id` | 已导入论文的阅读视图 |
| `#/quiz` | 刷题主页（模式选择 + 题库管理） |
| `#/quiz/session` | 刷题会话（计时 + 进度 + 统计） |
| `#/settings` | 设置页（API Key + 刷题参数） |
| `#/template` | JSON 题库模板页（下载 + 格式说明） |

## 项目结构

```
paperlens/
├── index.html
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitattributes
├── .env.example
├── README.md
├── src/
│   ├── css/
│   │   ├── design-tokens.css
│   │   ├── shell.css
│   │   ├── components.css
│   │   └── animations.css
│   ├── js/
│   │   ├── app.js
│   │   ├── router.js
│   │   ├── state.js
│   │   ├── modules/
│   │   │   ├── paper-reader/
│   │   │   │   ├── reader-core.js
│   │   │   │   ├── doc-viewer.js
│   │   │   │   ├── ai-panel.js
│   │   │   │   ├── annotation.js
│   │   │   │   └── exporter.js
│   │   │   ├── quiz/
│   │   │   │   ├── quiz-core.js
│   │   │   │   ├── sequential.js
│   │   │   │   ├── weighted-random.js
│   │   │   │   ├── error-book.js
│   │   │   │   └── template-gen.js
│   │   │   └── admin/
│   │   │       ├── auth.js
│   │   │       ├── entrance.js
│   │   │       └── dashboard.js
│   │   ├── services/
│   │   │   ├── ai-engine.js
│   │   │   ├── file-parser.js
│   │   │   ├── storage.js
│   │   │   └── api-keys.js
│   │   └── utils/
│   │       ├── alias-method.js
│   │       ├── mfaw.js
│   │       └── crypto.js
│   ├── views/
│   │   ├── home.html
│   │   ├── reader.html
│   │   ├── quiz.html
│   │   ├── quiz-session.html
│   │   ├── settings.html
│   │   └── template.html
│   └── assets/
├── server/
│   ├── routes/
│   │   ├── ai.js
│   │   ├── admin.js
│   │   └── files.js
│   ├── middleware/
│   │   └── auth.js
│   └── services/
│       ├── ai-provider.js
│       ├── verifier.js
│       └── doc-parser.js
├── scripts/
│   ├── start.bat
│   ├── start.sh
│   ├── docker-build.sh
│   ├── docker-up.sh
│   ├── docker-down.sh
│   ├── package.sh
│   └── wsl2-test.sh
└── data/
    └── ai-logs/
```

## 依赖项

### 前端（CDN，零安装）
- PDF.js (PDF 渲染)
- mammoth.js (DOCX 解析)
- marked.js (Markdown 解析)

### 后端（npm）
- express
- express-session
- multer (文件上传)
- pdf-parse
- mammoth
- marked
- dotenv
- crypto (Node 内置)

## 运维脚本

| 脚本 | 平台 | 功能 |
|---|---|---|
| `start.bat` | Windows | npm install + node server.js |
| `start.sh` | Linux/WSL | npm install + node server.js |
| `docker-build.sh` | Linux/WSL | docker build -t paperlens . |
| `docker-up.sh` | Linux/WSL | docker-compose up -d |
| `docker-down.sh` | Linux/WSL | docker-compose down |
| `package.sh` | Linux/WSL | 打包为 paperlens-{ver}.tar.gz |
| `wsl2-test.sh` | WSL2 | 进入 WSL2 执行完整测试 |
