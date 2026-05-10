export type TabKey = "integration" | "qa" | "dialogue" | "report";

export interface TextbookSummary {
  id: string;
  title: string;
  filename: string;
  format: string;
  uploaded_at: string;
  status: string;
  stats: {
    characters: number;
    sections: number;
    chunks: number;
    keywords: number;
  };
  keyword_preview: string[];
}

export interface TextbookDetail extends TextbookSummary {
  stored_path: string;
  summary_preview: string;
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: Record<string, number>;
}

export interface AnalysisResult {
  overview: {
    textbook_count: number;
    shared_keyword_count: number;
  };
  shared_keywords: Array<{
    term: string;
    textbooks: string[];
  }>;
  pairwise_similarity: Array<{
    left_textbook: string;
    right_textbook: string;
    similarity: number;
    shared_terms: string[];
  }>;
  unique_topics: Record<string, string[]>;
  missing_topics: Record<string, string[]>;
  combined_graph: GraphData;
}

export interface IntegrationResult {
  summary_ratio: number;
  original_characters: number;
  summary_characters: number;
  summary_text: string;
  items: Array<{
    text: string;
    source: {
      textbook_id: string;
      textbook_title: string;
      section_title: string;
    };
  }>;
}

export interface Citation {
  textbook_id: string;
  textbook_title: string;
  section_title: string;
  chunk_id: string;
  score: number;
  content: string;
}

export interface QAResult {
  mode: string;
  question: string;
  answer: string;
  citations: Citation[];
}

export interface DialogueTurn {
  id: string;
  timestamp: string;
  teacher_message: string;
  assistant_message: string;
  mode: string;
}

export interface ReportItem {
  generated_at: string;
  filename: string;
  textbook_count: number;
  shared_keyword_count: number;
  path?: string;
  content?: string;
}
