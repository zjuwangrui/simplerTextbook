# prompts/knowledge_graph_prompt.py

CHAPTER_EXTRACTION_PROMPT = """
你是一位顶尖的学科知识工程专家。请分析以下【章节内容】，提取该章节中的核心知识点，并识别它们之间的关系。

## 任务要求
1. **只提取本章节的核心知识点**（概念、定理、方法、现象、理论等）
2. **忽略**：示例、习题、重复说明、次要细节
3. **每个知识点**必须有明确的定义和分类

## 输出格式（严格JSON）
{
  "chapter_info": {
    "chapter_name": "章节名称",
    "page_range": [起始页, 结束页],
    "summary": "本章核心内容一句话总结"
  },
  "knowledge_nodes": [
    {
      "id": "node_001",
      "name": "知识点名称",
      "definition": "精准的定义或描述（30-100字）",
      "category": "核心概念|定理|方法|现象|理论",
      "chapter": "章节名",
      "page": 页码
    }
  ],
  "relationships": [
    {
      "source": "node_001",
      "target": "node_002",
      "relation_type": "prerequisite|parallel|contains|applies_to",
      "description": "关系描述（说明为什么存在这种关系）"
    }
  ]
}

## 关系类型说明
- **prerequisite（前置依赖）**：必须先掌握A才能理解B
- **parallel（并列关系）**：同一层级、可以对比学习的平行概念
- **contains（包含关系）**：A是B的上位概念，B是A的组成部分
- **applies_to（应用关系）**：A是B的应用场景或实践方法

## Few-shot示例
【示例章节内容】：
"静息电位是指细胞在安静状态下膜两侧的电位差，通常内负外正。当细胞受到刺激时，膜电位会发生快速逆转，产生动作电位。动作电位包括去极化和复极化两个阶段。"

【正确输出】：
{
  "knowledge_nodes": [
    {
      "id": "node_001",
      "name": "静息电位",
      "definition": "细胞在未受刺激时，细胞膜内外存在的稳定电位差，通常表现为内负外正",
      "category": "核心概念",
      "chapter": "第二章 细胞的基本功能",
      "page": 35
    },
    {
      "id": "node_002",
      "name": "动作电位",
      "definition": "细胞受到刺激后，膜电位发生的一次快速、可逆的倒转和恢复过程",
      "category": "核心概念",
      "chapter": "第二章 细胞的基本功能",
      "page": 36
    }
  ],
  "relationships": [
    {
      "source": "node_001",
      "id": "node_002",
      "relation_type": "prerequisite",
      "description": "理解动作电位的产生机制，必须先掌握静息电位的概念"
    }
  ]
}

## 【章节内容开始】
{chapter_content}

## 【章节内容结束】

请严格按照JSON格式输出，不要添加任何额外解释。
"""