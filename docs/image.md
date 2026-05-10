为每本教材分别构建知识图谱并以可视化形式展示。
具体要求：
• 对每个章节调用LLM，提取该章节中的核心知识点（概念、定理、方法、现象等）
• 每个知识点需要结构化输出：
{
"id": "node_001",
"name": "动作电位",
"definition": "细胞受到刺激后，膜电位发生的一次快速而可逆的倒转...",
"category": "核心概念",
"chapter": "第二章 细胞的基本功能",
"page": 35
}
• 识别知识点之间的关系，关系类型至少包含以下四种中的三种：
关系类型 说明 示例
前置依赖（prerequisite） 学习 B 之前必须先掌握 A  "动作电位”依赖”静息电位”
并列关系（parallel）同一层级的平行概念 "有丝分裂”与”减数分裂”
包含关系（contains） 上位概念与下位概念  "免疫系统”包含”T细胞”
应用关系（applies_to） 某知识点是另一个的应用场景 ”抗体”应用于”体液免疫”
• 关系的输出结构：
{
"source": "node_001",
"target": "node_002",
"relation_type": "prerequisite",
"description": "理解动作电位需要先掌握静息电位的概念"
}
• LLM调用时的Prompt设计建议：明确要求输出JSON格式，给出few-shot示例，
限制每次调用只处理一个章节（避免上下文过长）
llm的prompt可以写成文档，放在src\backend\config\prompt.md，并且这个文件的路径可以配置。prompt.md里面是现在的示例提示词，后续可以根据需要修改和优化提示词内容。

写两个测试后端api的powershell脚本：
1. 先解析pdf正文，保存解析结果到 tests\output\text.json。
2. 再基于解析结果单独生成知识图谱json，保存到 tests\output\image.json。

要求：
- 无命令行参数，在脚本内部设置参数和变量。
- `text.json` 和 `image.json` 都采用数组结构，每次运行追加新结果，不覆盖旧结果。
- 每条记录保留 `metadata`、`description`、`result`。
- 脚本尽量简洁明了，注释清晰。
