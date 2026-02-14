export interface Language {
  id: number;
  code: string;
  name: string;
  native_name: string;
  flag_emoji: string;
  is_active: boolean;
}

export interface ResearchWeek {
  id: number;
  week_start: string;
  status: string;
  problem_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface ResearchProblem {
  id: number;
  week_id: number;
  title: string;
  description: string;
  severity: number;
  trending_direction: string;
  primary_niche: string;
  related_niches: string[];
  country: string;
  language: string;
  source_count: number;
  source_urls: string[];
  suggested_angles: string[];
  keywords: string[];
  language_variants: Record<string, string>;
  created_at: string;
}

export interface ContentTemplate {
  id: number;
  name: string;
  slug: string;
  content_type: string;
  description: string;
  structure: TemplateField[];
  visual_layout: string;
  visual_css: string;
  system_prompt: string;
  default_tone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface TemplateField {
  name: string;
  type: string;
  required?: boolean;
  max_length?: number;
  min_items?: number;
  max_items?: number;
  description?: string;
  item_schema?: Record<string, { type: string; max_length?: number; description?: string }>;
}

export interface ContentItem {
  id: number;
  problem_id: number | null;
  template_id: number;
  title: string;
  language: string;
  country: string | null;
  status: string;
  content_data: Record<string, unknown>;
  rendered_html: string | null;
  tone: string;
  generation_model: string;
  generation_tokens: number;
  parent_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface DashboardData {
  total_content: number;
  total_published: number;
  total_impressions: number;
  total_engagement: number;
  top_content: { id: number; title: string; engagement: number }[];
  content_by_type: Record<string, number>;
  content_by_language: Record<string, number>;
}

export interface VideoJob {
  id: number;
  content_item_id: number;
  provider: string;
  status: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  error_message: string;
}
