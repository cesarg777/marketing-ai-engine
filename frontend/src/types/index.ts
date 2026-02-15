export interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string;
  flag_emoji: string;
  is_active: boolean;
}

export interface ResearchWeek {
  id: string;
  week_start: string;
  status: string;
  problem_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface ResearchConfig {
  id: string;
  name: string;
  niches: string[];
  countries: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ResearchProblem {
  id: string;
  week_id: string;
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
  id: string;
  org_id: string | null;
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
  id: string;
  problem_id: string | null;
  template_id: string;
  title: string;
  language: string;
  country: string | null;
  status: string;
  content_data: Record<string, unknown>;
  rendered_html: string | null;
  tone: string;
  generation_model: string;
  generation_tokens: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface DashboardData {
  total_content: number;
  total_published: number;
  total_impressions: number;
  total_engagement: number;
  top_content: { id: string; title: string; engagement: number }[];
  content_by_type: Record<string, number>;
  content_by_language: Record<string, number>;
}

export interface VideoJob {
  id: string;
  content_item_id: string;
  provider: string;
  status: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  error_message: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  brand_voice: Record<string, unknown>;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string;
  created_at: string;
}

export interface OrgResource {
  id: string;
  org_id: string;
  resource_type: string;
  name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface ResourceType {
  type: string;
  label: string;
  accepts: string;
  has_file: boolean;
}

export interface Publication {
  id: string;
  content_item_id: string;
  channel: string;
  external_id: string;
  external_url: string;
  published_at: string;
  status: string;
}
