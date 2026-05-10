# SimplerTextbook

## 项目简介

`SimplerTextbook` 是一个面向多教材知识整合的教学辅助系统。项目支持上传多本教材，完成正文解析、章节结构化、知识图谱构建、跨教材主题分析、整合摘要生成、RAG 问答与分析报告输出，适用于教学内容比对、知识点梳理和课程资料整合场景。

当前系统采用前后端分离架构：

- 前端：React + TypeScript + Vite
- 后端：Flask 分层服务
- 图谱交互：Cytoscape.js
- 持久化：本地文件系统（JSON、上传文件、日志、报告）

## 环境依赖

建议按当前代码运行环境使用以下版本：

- Python `3.12`
- Node.js `20`
- npm `10+`
- Docker / Docker Compose（如需容器化运行）

## 项目结构

```text
src/
  backend/     Flask 后端服务
  frontend/    React 前端单页应用
docs/          需求、设计与接口文档
runtime/       运行期数据目录
tests/         后端测试脚本与输出结果
```

## 安装步骤

### 1. 克隆并进入项目

```bash
git clone <your-repo-url>
cd simplerTextbook
```

### 2. 安装后端依赖

```bash
cd src/backend
pip install -r requirements.txt
cd ../..
```

### 3. 安装前端依赖

```bash
cd src/frontend
npm install
cd ../..
```

## 配置说明

### 1. `.env` 文件

项目根目录提供了 [.env.example](/D:/constructing_projects/simplerTextbook/.env.example)。  
如需使用 Docker，先复制为 `.env`：

```bash
cp .env.example .env
```

`.env` 主要用于 Docker 构建阶段配置：

- `PYTHON_BASE_IMAGE`
- `NODE_BASE_IMAGE`
- `NGINX_BASE_IMAGE`
- `PIP_INDEX_URL`
- `PIP_EXTRA_INDEX_URL`
- `NPM_REGISTRY`

这些配置用于镜像源或依赖源切换，不参与应用业务逻辑。

### 2. 后端运行配置

后端运行时配置在 [src/backend/config/app.yaml](/D:/constructing_projects/simplerTextbook/src/backend/config/app.yaml)，包括：

- 服务监听地址与端口
- 上传大小限制
- 存储目录
- 文本切块参数
- RAG 参数
- LLM 调用参数

重点字段：

- `app.port`
- `app.max_upload_mb`
- `storage.*`
- `processing.*`
- `rag.top_k`
- `llm.enabled`
- `llm.base_url`
- `llm.api_key`
- `llm.model`
- `llm.prompt_file`

### 3. 知识图谱 Prompt

知识图谱章节级抽取提示词在 [src/backend/config/prompt.md](/D:/constructing_projects/simplerTextbook/src/backend/config/prompt.md)。  
该文件用于控制“单章节知识点 + 关系”的 LLM 输出格式，后续可按比赛需要继续优化。

## 启动命令

### 本地启动

#### 启动后端

```bash
cd src/backend
python app.py
```

后端默认地址：

- `http://localhost:5000`

#### 启动前端

```bash
cd src/frontend
npm run dev
```

前端开发地址：

- `http://localhost:5173`

### Docker 启动

```bash
docker compose up --build
```

容器启动后：

- 前端：`http://localhost:8080`
- 后端：`http://localhost:5000`

## 使用说明

### 1. 上传教材

在前端左侧上传区拖拽或选择教材文件，当前支持：

- PDF
- Markdown
- TXT
- Word `.docx`

系统会先完成文件落盘，再在后台解析正文与章节结构。

### 2. 查看解析状态

上传后，教材列表会显示：

- 文件名
- 格式
- 文件大小
- 解析状态
- 页数 / 字数
- 解析进度

### 3. 生成知识图谱

教材正文解析完成后，可在中间图谱区域点击“生成图谱”。  
系统会按章节调用 LLM，提取：

- 核心知识点
- 知识点定义
- 关系类型

并生成可交互的知识图谱。

当前图谱支持：

- 点击节点查看详情
- 鼠标滚轮缩放
- 拖动画布
- 拖动节点
- 关键词搜索高亮
- 多教材来源区分
- 频次可视化

### 4. 跨教材分析

右侧“整合操作”页签可执行跨教材对比分析，识别：

- 重叠主题
- 差异主题
- 缺失主题

### 5. 整合摘要

系统支持按目标压缩比例生成多教材整合摘要，用于快速形成精华版内容。

### 6. RAG 问答

在“RAG问答”页签中输入问题，系统将基于教材原文检索片段进行回答，并附带引用依据。

### 7. 教师反馈与报告

系统支持记录教师反馈，并生成 Markdown 格式分析报告。

## 测试脚本

项目提供两个后端测试脚本：

- [tests/Parse-Textbook.ps1](/D:/constructing_projects/simplerTextbook/tests/Parse-Textbook.ps1)
- [tests/Generate-GraphJson.ps1](/D:/constructing_projects/simplerTextbook/tests/Generate-GraphJson.ps1)

用途：

- `Parse-Textbook.ps1`：上传 PDF 并保存正文解析结果到 `tests/output/text.json`
- `Generate-GraphJson.ps1`：基于解析结果单独生成知识图谱 JSON，并追加写入 `tests/output/image.json`

## 补充文档

- [docs/需求分析.md](/D:/constructing_projects/simplerTextbook/docs/需求分析.md)
- [docs/系统设计.md](/D:/constructing_projects/simplerTextbook/docs/系统设计.md)
- [docs/接口文档.md](/D:/constructing_projects/simplerTextbook/docs/接口文档.md)
- [docs/Agent架构说明.md](/D:/constructing_projects/simplerTextbook/docs/Agent架构说明.md)
