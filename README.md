# LearningTool — 智能论文阅读 & 刷题工具

Claude 古典美学风格 · 模块化架构 · 跨平台 · 一键容器化

---

## 系统要求

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| Node.js | ≥ 20.0.0 | 运行时环境 |
| npm | ≥ 9.0.0 | 随 Node.js 自带 |
| （容器化）Docker | ≥ 24.0.0 | 仅 Docker 部署需要 |
| （容器化）Docker Compose | ≥ 2.0.0 | 仅 Docker 部署需要 |
| 浏览器 | Chrome / Firefox / Edge 最新版 | 不支持 IE |

---

## 部署方式

### 方式一：Windows 源码部署（推荐首次使用）

项目根目录提供了 `scripts/start.bat` 一键脚本，**自动完成：创建配置文件 → 安装依赖 → 启动服务**。

```bat
scripts\start.bat
```

如果一键脚本无法运行，手动执行以下步骤：

```bat
:: 1. 创建配置文件
copy .env.example .env

:: 2. 编辑 .env，填入你的 DeepSeek API Key
notepad .env

:: 3. 安装依赖
npm install

:: 4. 启动服务
npm start
```

浏览器打开 `http://localhost:3000`。

---

### 方式二：Linux / WSL2 源码部署（推荐首次使用）

项目根目录提供了 `scripts/start.sh` 一键脚本，**自动完成：创建配置文件 → 安装依赖 → 启动服务**。

```bash
chmod +x scripts/*.sh
./scripts/start.sh
```

如果一键脚本无法运行，手动执行以下步骤：

```bash
# 1. 创建配置文件
cp .env.example .env

# 2. 编辑 .env，填入你的 DeepSeek API Key
nano .env

# 3. 安装依赖
npm install

# 4. 启动服务
npm start
```

浏览器打开 `http://localhost:3000`。

---

### 方式三：Docker 容器化部署

使用 Docker Compose 一键构建并启动（自动处理环境变量和数据持久化）：

```bash
chmod +x scripts/*.sh
./scripts/docker-up.sh
```

或手动执行：

```bash
# 1. 创建配置文件（如尚未创建）
cp .env.example .env
nano .env

# 2. 构建镜像并启动
docker-compose up -d

# 3. 查看运行状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f

# 5. 停止服务
docker-compose down
```

浏览器打开 `http://localhost:3000`。

---

### 方式四：便携打包部署

将项目打包为 `tar.gz` 归档，复制到任意 Linux 服务器解压即用：

```bash
./scripts/package.sh
# 生成 paperlens-1.0.0.tar.gz

# 在目标机器上：
tar -xzf paperlens-1.0.0.tar.gz
cd paperlens
cp .env.example .env
nano .env          # 配置 API Key
npm install
npm start
```

---

## 配置说明

编辑项目根目录下的 `.env` 文件（从 `.env.example` 复制而来）：

| 变量 | 说明 | 必填 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（管理员预配） | 是 |
| `SESSION_SECRET` | 会话加密密钥 | 建议修改 |
| `PORT` | 服务端口，默认 3000 | 否 |

---

## 功能

- **论文阅读** — 多格式文档导入（PDF/DOCX/TXT/MD），左原文右 AI 解释分屏，Tab 键切换焦点，勾画笔记一键导出
- **智能刷题** — JSON 模板导入选择题，三种模式：顺序 / 加权乱序(MFAW 算法) / 错题本，科学权重自适应
- **AI 引擎** — 支持用户自带 API Key，管理员预配 DeepSeek，双通道验证保证输出质量
- **隐秘管理** — 无 UI 痕迹的管理员入口，仅授权用户可访问 AI 模型

---

## 项目结构

```
paperlens/
├── index.html              # SPA 入口页面
├── server.js               # Express 后端入口
├── package.json            # Node.js 依赖声明
├── .env.example            # 环境变量模板
├── Dockerfile              # Docker 镜像定义
├── docker-compose.yml      # Docker 编排文件
├── src/                    # 前端源代码
│   ├── css/                # 样式系统（4 个文件）
│   ├── js/                 # JavaScript 模块（16 个文件）
│   └── views/              # HTML 视图片段（6 个文件）
├── server/                 # 后端源代码
│   ├── routes/             # API 路由（AI / 管理 / 文件）
│   ├── middleware/          # 认证中间件
│   └── services/            # 服务层（AI引擎 / 校验 / 文档解析）
├── scripts/                # 运维脚本（启动 / 容器化 / 打包 / WSL2测试）
└── data/                   # 运行时数据（gitignored）
    ├── ai-logs/            # AI 输出日志
    └── uploads/            # 上传文件
```

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | 原生 HTML/CSS/JS (ES Modules) | 零框架、零构建 |
| 后端 | Node.js + Express | REST API + SSE |
| 美学 | Claude Design System | DM Sans、暖色调、cubic-bezier |
| AI | DeepSeek-v4-flash[1m] / DeepSeek-v4-pro[1m] | 后端代理，Key 不暴露前端 |
| 容器化 | Docker + Docker Compose | 一键构建，数据卷持久化 |

---

## 许可证

MIT
