export type TabKey = "integration" | "qa" | "dialogue" | "report";
export type TextbookStatus = "parsing" | "ready" | "failed";
export type GraphStatus = "not_started" | "building" | "ready" | "failed";

export interface ParseProgress {
  phase: string;
  current_page: number;
  total_pages: number;
  percent: number;
  message: string;
  updated_at?: string;
}

export interface GraphProgress {
  phase: string;
  current_chapter: number;
  total_chapters: number;
  percent: number;
  message: string;
  updated_at?: string;
}

export interface TextbookStats {
  characters: number;
  sections: number;
  chunks: number;
  keywords: number;
  pages?: number;
}

export interface TextbookSectionSummary {
  section_id: string;
  title: string;
  page_start: number;
  page_end: number;
  content: string;
  char_count: number;
}

export interface TextbookChapter {
  chapter_id: string;
  title: string;
  page_start: number;
  page_end: number;
  content: string;
  char_count: number;
  sections?: TextbookSectionSummary[];
}

export interface ParsedOutput {
  textbook_id: string;
  filename: string;
  title: string;
  total_pages: number;
  total_chars: number;
  chapters: TextbookChapter[];
}

export interface TextbookSummary {
  id: string;
  textbook_id?: string;
  title: string;
  filename: string;
  format: string;
  uploaded_at: string;
  status: TextbookStatus;
  file_size_bytes: number;
  total_pages: number;
  total_chars: number;
  parse_progress: ParseProgress;
  error_message?: string;
  graph_status: GraphStatus;
  graph_progress: GraphProgress;
  graph_error_message?: string;
  stats: TextbookStats;
  keyword_preview: string[];
}

export interface TextbookDetail extends TextbookSummary {
  textbook_id: string;
  stored_path: string;
  summary_preview: string;
  chapters: TextbookChapter[];
  parsed_output?: ParsedOutput;
}

export interface GraphMention {
  textbook_title?: string;
  chapter: string;
  page: number;
  source_temp_id: string;
}

export interface GraphNode {
  id: string;
  label: string;
  name?: string;
  group: string;
  weight: number;
  definition?: string;
  category?: string;
  chapter?: string;
  page?: number;
  chapters?: string[];
  mentions?: GraphMention[];
  frequency?: number;
  source_textbooks?: string[];
  source_count?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  relation_type?: string;
  description?: string;
  label?: string;
  source_textbooks?: string[];
}

export interface GraphChapterSummary {
  chapter_id: string;
  chapter_title: string;
  page_start: number;
  page_end: number;
  knowledge_point_count: number;
  relation_count: number;
}

export interface GraphStats {
  node_count?: number;
  edge_count?: number;
  chapter_count?: number;
  relation_type_count?: number;
  textbook_count?: number;
  shared_keyword_count?: number;
  [key: string]: number | undefined;
}

export interface GraphData {
  textbook_id?: string;
  textbook_title?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
  relation_types?: string[];
  chapter_graphs?: GraphChapterSummary[];
  description?: string;
  graph_status?: GraphStatus;
  graph_progress?: GraphProgress;
  graph_error_message?: string;
  source_textbooks?: string[];
}

export interface GraphStatusResponse {
  id: string;
  textbook_id: string;
  title: string;
  graph_status: GraphStatus;
  graph_progress: GraphProgress;
  graph_error_message?: string;
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
