# SimplerTextbook

基于 `docs/需求分析.md` 与 `docs/系统设计.md` 搭建的初版教材知识整合系统。

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Flask 分层架构
- 持久化：文件系统 JSON + 上传文件目录
- 容器化：Docker + docker compose

## 目录

- `src/frontend`：前端单页应用
- `src/backend`：后端服务
- `docs/接口文档.md`：接口说明
- `docs/Agent架构说明.md`：Agent 架构设计
- `runtime/backend`：Docker 运行时数据目录

## 配置

后端配置文件在 [src/backend/config/app.yaml](/D:/constructing_projects/simplerTextbook/src/backend/config/app.yaml)。

可直接修改以下参数：

- `app.host` / `app.port`
- `storage.*`
- `processing.*`
- `rag.top_k`
- `llm.enabled`
- `llm.base_url`
- `llm.api_key`
- `llm.model`
- `llm.prompt_file`

如果你要接入真实大模型问答，把 `llm.enabled` 改为 `true`，并填写 `api_key` 和对应的 OpenAI 兼容接口地址。

知识图谱章节级抽取提示词在 [prompt.md](/D:/constructing_projects/simplerTextbook/src/backend/config/prompt.md)，路径由 `llm.prompt_file` 控制，可以后续持续优化。

## 启动

### Docker

```bash
docker compose up --build
```

启动后：

- 前端：`http://localhost:8080`
- 后端：`http://localhost:5000`

### Docker Hub 拉取失败时

如果你看到类似下面的报错：

- `failed to resolve source metadata for docker.io/...`
- `Docker Desktop has no HTTPS proxy`

这说明问题不在项目代码，而在 Docker Desktop 到镜像仓库的网络链路。

你可以按这个顺序处理：

1. 如果你所在网络必须经过代理，先在 Docker Desktop 的 `Settings -> Resources -> Proxies` 中配置 `HTTPS proxy`，不要只配系统终端代理。
2. 如果你不走代理，但 `docker.io` 在当前网络不可达，就在项目根目录复制一份 `.env.example` 为 `.env`，把基础镜像改成你自己的内网镜像仓库地址或可信镜像源地址。
3. 如果基础镜像能拉，但 `pip install` 或 `npm install` 超时，就继续在 `.env` 里配置 `PIP_INDEX_URL`、`PIP_EXTRA_INDEX_URL`、`NPM_REGISTRY`。
4. 修改后重新执行：

```bash
docker compose build --no-cache
docker compose up
```

示例：如果你的内网仓库里已经同步了官方镜像，可以把 `.env` 改成这种形式：

```dotenv
PYTHON_BASE_IMAGE=your-registry.example.com/library/python:3.12-slim
NODE_BASE_IMAGE=your-registry.example.com/library/node:20-alpine
NGINX_BASE_IMAGE=your-registry.example.com/library/nginx:1.27-alpine
PIP_INDEX_URL=https://your-pypi-mirror/simple
NPM_REGISTRY=https://your-npm-mirror/
```

注意：即使基础镜像能拉下来，构建过程中仍然需要访问 `pip` 和 `npm` 源下载依赖；如果这些也受限，还需要同时配置 Python 和 npm 的可达源。

### 本地开发

前端：

```bash
cd src/frontend
npm install
npm run dev
```

后端：

```bash
cd src/backend
pip install -r requirements.txt
python app.py
```

## 初版能力范围

- 多教材上传与解析：`pdf`、`docx`、`txt`、`md`
- 大文件上传后后台逐页解析 PDF，并通过状态轮询返回进度
- 单教材知识图谱生成
- 跨教材重叠/互补/缺失主题分析
- 30% 以内目标比例的抽取式整合摘要
- 基于教材原文片段的 RAG 问答与引用
- 教师反馈对话记录
- Markdown 报告生成与落盘

## 测试脚本

后端测试脚本拆成两步：

- [Parse-Textbook.ps1](/D:/constructing_projects/simplerTextbook/tests/Parse-Textbook.ps1)
- [Generate-GraphJson.ps1](/D:/constructing_projects/simplerTextbook/tests/Generate-GraphJson.ps1)

先解析正文：

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\Parse-Textbook.ps1
```

再生成图谱 JSON：

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\Generate-GraphJson.ps1
```

输出文件：

- `tests/output/text.json`：解析后的正文结构结果，作为图谱生成输入
- `tests/output/image.json`：知识图谱可视化 JSON 结果

## 说明

- 没有引入 mock 服务。
- 问答默认可用本地检索+摘录方式运行；配置外部 LLM 后会切换到真实模型生成。
- 按你的要求，这次我没有替你运行项目或容器。
