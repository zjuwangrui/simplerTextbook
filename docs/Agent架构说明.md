# Agent 架构说明

## 设计目标

初版系统围绕“多教材加载 -> 结构化分析 -> 整合摘要 -> 检索问答 -> 教师反馈迭代”构建。  
当前实现没有拆成多个独立进程 Agent，而是采用“服务模块映射 Agent 职责”的方式，先把端到端能力打通。

## Agent 划分

### 1. Material Loader Agent

职责：

- 接收多教材上传
- 解析 `pdf`、`docx`、`txt`、`md`
- 完成标准化清洗、章节识别、文本切块

对应实现：

- `TextbookService`
- `file_loader.py`
- `text_processing.py`

### 2. Graph Builder Agent

职责：

- 提取教材关键词
- 基于章节和共现关系构建知识图谱
- 输出前端可视化所需的节点和边

对应实现：

- `GraphService`

### 3. Curriculum Comparator Agent

职责：

- 识别跨教材共享主题
- 计算两两教材相似度
- 给出互补与缺失主题

对应实现：

- `AnalysisService`

### 4. Integrator Agent

职责：

- 在限定压缩比例下提炼多教材精华内容
- 保留来源信息，支撑后续问答与报告

对应实现：

- `IntegrationService`

### 5. Retriever / QA Agent

职责：

- 对教材切块建立可检索语料
- 基于问题召回高相关原文
- 输出答案与引用

对应实现：

- `QAService`

说明：

- 默认模式：本地 TF-IDF 检索 + 摘录式回答
- 增强模式：接入 OpenAI 兼容 LLM 后生成带引用回答

### 6. Teacher Collaboration Agent

职责：

- 记录教师多轮反馈
- 结合当前分析结果给出调整建议
- 为整合方案迭代提供上下文

对应实现：

- `DialogueService`
- `ConversationRepository`

### 7. Reporting Agent

职责：

- 汇总教材概览、跨教材分析、整合摘要、教师反馈
- 输出 Markdown 报告并落盘

对应实现：

- `ReportService`
- `ReportRepository`

## 数据流

1. 教材上传后进入 `TextbookService`
2. 文本被切分为章节、检索块、关键词
3. `GraphService` 生成图谱
4. `AnalysisService` 完成跨教材比较
5. `IntegrationService` 生成整合摘要
6. `QAService` 基于检索块回答问题
7. `DialogueService` 记录教师反馈并返回建议
8. `ReportService` 汇总结果输出报告

## 后续可扩展方向

- 把各 Agent 拆成异步任务流
- 引入向量数据库替代当前内存 TF-IDF 检索
- 增加更强的章节结构识别与知识点抽取
- 引入教师反馈驱动的摘要重排策略



架构总览、设计决策论证、数据流、取舍与权衡