# 政鉴 · JZPT

> **全球政经洞察与逻辑解构平台** — 生产级原型工程  
> Global Political & Economic Insight · Logic Deconstruction Platform

---

## 项目简介

**政鉴（JZPT）** 是一个面向政经资讯的 **AI 深度解构平台原型**，将传统新闻阅读升级为「可分析、可解释、可对比」的结构化体验。

平台整合 **新闻流 · 宏观数据侧栏 · 三维逻辑分析** 于同一视图，服务于政策信息理解、决策辅助与认知研究场景。

### 双模式数据架构

| 模式 | 开关位置 | 新闻来源 | AI 分析来源 | 适用场景 |
|------|----------|----------|-------------|----------|
| **Mock** | 右下角 `Data: Mock` | `lib/mockData.ts` 本地演示数据 | 前端 `presetAnalysis` 打字机流式展示 | 产品演示、UI 验收、无后端环境 |
| **Real** | 右下角 `Data: Real` | FastAPI `GET /news`（新华网 RSS → SQLite） | FastAPI `POST /analyze`（Gemini 流式 NDJSON） | 联调、真实数据验证、AI 能力测试 |

> 模式选择持久化于浏览器 `localStorage`，刷新页面后仍保留上次选择。

---

## 技术栈一览

### 前端

| 类别 | 技术 | 版本 / 说明 |
|------|------|-------------|
| 框架 | Next.js（App Router） | 16.x |
| UI 库 | React | 19.x |
| 样式 | Tailwind CSS | 4.x |
| 语言 | TypeScript | 5.x |
| 图标 | lucide-react | — |

### 后端

| 类别 | 技术 | 版本 / 说明 |
|------|------|-------------|
| 框架 | FastAPI | — |
| 运行时 | Uvicorn | — |
| ORM | SQLAlchemy | — |
| 数据库 | SQLite | `backend/jzpt.db`（路径固定，与启动目录无关） |
| AI | Google Gemini | `gemini-1.5-flash`（NDJSON 流式输出） |
| 新闻源 | feedparser | 新华网时政 RSS |

### 工程与协议

| 项目 | 说明 |
|------|------|
| 流式协议 | NDJSON：每行 `{"d":"片段"}` 或 `{"e":"错误"}` |
| 分析缓存 | SQLite `news.analysis` 字段，按 **新闻 ID 精确匹配** |
| 废弃路由 | `app/api/analyze/route.ts` → HTTP 410 Gone |

---

## 5 分钟本地快速启动

### 前置要求

| 依赖 | 最低版本 |
|------|----------|
| Node.js | 18+ |
| Python | 3.10+ |
| 包管理器 | npm |

### 第一步：克隆并安装前端依赖

```bash
git clone <your-repo-url>
cd jzpt
npm install
```

### 第二步：配置环境变量

见下方 [环境变量配置说明](#环境变量配置说明)。

### 第三步：启动前端（终端 1）

```bash
npm run dev
```

访问：**http://localhost:3000**

### 第四步：启动后端（终端 2）

**推荐方式（统一启动脚本，自动清端口 + 固定虚拟环境）：**

```bash
npm run dev:backend
```

**或直接运行 PowerShell 脚本：**

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/start-backend.ps1
```

后端地址：**http://127.0.0.1:8000**

> `scripts/start-backend.ps1` 会自动：
> 1. 切换到项目根目录  
> 2. 使用 `.venv\Scripts\python.exe`  
> 3. 释放被占用的 **8000** 端口（Windows 多进程残留清理）  
> 4. 启动 `backend/main.py`，数据库固定为 `backend/jzpt.db`

### 第五步：验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 http://localhost:3000 | 首页正常渲染 |
| 2 | 右下角切到 **Real** | 新闻列表从后端加载 |
| 3 | 点击「查看逻辑分析」 | 流式输出 AI 解构内容 |
| 4 | 切到 **Mock** 再点分析 | 本地演示内容，**不请求后端** |

### Python 虚拟环境（首次）

若 `.venv` 不存在，需先创建并安装依赖：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn feedparser python-dotenv sqlalchemy google-generativeai
```

---

## 环境变量配置说明

### 前端 — `.env.local`（项目根目录）

| 变量 | 必填 | 示例值 | 说明 |
|------|------|--------|------|
| `NEXT_PUBLIC_API_BASE_URL` | 否 | `http://localhost:8000` | Real 模式下前端请求后端的 Base URL；未设置时默认 `http://localhost:8000` |

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 后端 — `backend/.env`

| 变量 | 必填 | 示例值 | 说明 |
|------|------|--------|------|
| `GEMINI_API_KEY` | Real 模式 AI 必填 | `AIza...` | [Google AI Studio](https://aistudio.google.com/) 申请 |
| `GEMINI_FIRST_CHUNK_TIMEOUT` | 否 | `30` | 首 token 超时（秒） |
| `GEMINI_INTER_CHUNK_TIMEOUT` | 否 | `20` | 后续 chunk 间隔超时（秒） |
| `GEMINI_STREAM_MAX_SECONDS` | 否 | `120` | 整段流最大时长（秒） |

```env
# backend/.env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **安全提示**：`.env*` 已在 `.gitignore` 中忽略，请勿将真实 Key 提交至 Git。

---

## 目录结构

```
jzpt/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 首页（12 栅格布局）
│   ├── layout.tsx                # 全局布局 + DataModeProvider
│   └── api/analyze/route.ts      # @deprecated → 410 Gone
├── components/
│   ├── PolicyNewsAnalysisFeed.tsx  # 核心：新闻流 + AI 分析
│   └── DevDataModeToggle.tsx       # Mock / Real 开关
├── contexts/DataModeContext.tsx  # 双模式状态管理
├── lib/mockData.ts               # Mock 新闻与 presetAnalysis
├── backend/
│   ├── main.py                   # FastAPI 入口（/news, /analyze）
│   ├── database.py               # SQLite 连接（固定 backend/jzpt.db）
│   ├── models.py                 # News ORM 模型
│   └── .env                      # GEMINI_API_KEY
├── scripts/
│   └── start-backend.ps1         # 统一后端启动脚本
├── .env.local                    # NEXT_PUBLIC_API_BASE_URL
└── package.json                  # npm run dev / dev:backend
```

---

## API 速查

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/news` | 抓取 RSS → 去重入库 → 返回新闻列表 |
| `POST` | `/analyze` | 流式 AI 分析（NDJSON） |

### `POST /analyze` 请求体

```json
{
  "id": 1,
  "title": "新闻标题",
  "content": "新闻标题\n\n摘要内容"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `int` | **优先**用于 SQLite 精确匹配与缓存查询 |
| `title` | `string` | 标题；`id` 未命中时降级匹配 |
| `content` | `string` | 送入 Gemini 的正文 |

### NDJSON 响应示例

```
{"d":"【宏观政策】"}
{"d":"本轮政策强调..."}
{"e":"调用大模型超时，请检查网络或 API Key"}
```

---

## 近期硬核重构记录

> 以下为本项目近期完成的关键工程化升级，显著提升了稳定性、可维护性与开发体验。

| # | 重构项 | 成果 |
|---|--------|------|
| 1 | **去除双路由冲突** | 删除 `backend/main.py` 第 246 行起整段 **DeepSeek 重复代码**（原 522 行 → 现 ~350 行），全局仅保留 **一个 FastAPI 实例**，统一 **Gemini** 流式分析 |
| 2 | **SQLite 语义级生成缓存** | AI 分析结果持久化至 `news.analysis`；二次请求按 **新闻 ID 精确命中**缓存，直接 NDJSON 流式回放，零 API 调用 |
| 3 | **前后端 NDJSON 流式协议规范化** | 统一 `{"d":"..."}` / `{"e":"..."}` 行格式；后端 async 生成器 + 后台线程拉流；前端 ReadableStream 逐行解析 |
| 4 | **Windows 多进程端口清理** | `scripts/start-backend.ps1` 启动前自动检测并释放 **8000** 端口，解决「旧后端占坑、新代码无法生效」问题 |
| 5 | **数据库路径固定** | `database.py` 使用绝对路径绑定 `backend/jzpt.db`，无论从根目录还是 `backend/` 启动，数据一致 |
| 6 | **Mock 模式完全本地化** | Mock 下 AI 分析走 `presetAnalysis`，不再误请求后端 `/analyze` |
| 7 | **ID 精确匹配升级** | 前端 Real 模式 POST 携带 `id`；后端优先 ID 查库，title 降级兼容旧客户端 |
| 8 | **废弃 Next.js 内置分析路由** | `app/api/analyze/route.ts` 返回 **410 Gone**，明确指向 FastAPI `/analyze` |

---

## 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| `8000 端口已被占用` | 旧后端进程未退出 | 运行 `npm run dev:backend`（自动清端口）或手动 `taskkill` |
| AI 一直转圈 | Gemini 网络不可达 / 首 token 慢 | 检查代理与 `GEMINI_API_KEY`；查看后端 `[analyze] first chunk` 日志 |
| Mock 模式正常、Real 失败 | 后端未启动或 Key 无效 | 确认 `npm run dev:backend` 运行中 |
| `python main.py` 找不到文件 | 路径错误 | 使用 `python backend/main.py` 或 `npm run dev:backend` |

---

## 产品愿景

- 接入真实 LLM 推理链路，支持更稳定的多轮分析与评测
- 引入提示词模板与输出规范治理，提升三维解构一致性
- 打通「新闻事件 → 宏观指标 → 国际反馈」联动分析路径
- 从「阅读资讯」走向「理解逻辑」，沉淀为可复用的智能研究工作台

---

## License

Private · Internal Prototype
