export interface Project {
  id: string;
  user_id: string;
  name: string;
  business_type?: string;
  timeline?: string;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: number; -- Changed to number as per SERIAL PRIMARY KEY
  project_id: string;
  phase_number: number;
  phase_name: string;
  description?: string; -- Added
  status: 'not_started' | 'in_progress' | 'complete' | 'locked'; -- Added 'locked'
  completion_percentage: number;
  created_at: string;
  updated_at: string; -- Added
}

export interface Step {
  id: number; -- Changed to number as per SERIAL PRIMARY KEY
  phase_id: number; -- Changed to number
  step_number: number;
  step_name: string;
  description?: string;
  why_matters?: string;
  timeline?: string; -- Added
  dependencies?: string[]; -- Changed to string[] for JSONB, will parse in app
  status: 'not_started' | 'in_progress' | 'complete';
  order_index?: number; -- Added
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  step_id: number; -- Changed to number
  document_name: string;
  document_type?: 'input' | 'output'; -- Added
  status: 'not_started' | 'in_progress' | 'complete'; -- Updated status options
  content?: string;
  current_version: number;
  created_at: string;
  updated_at: string; -- Added
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  version: number;
  change_description?: string;
  created_at: string;
}

export interface AiReview {
  id: string;
  document_id: string;
  strengths?: string[]; -- Changed to string[] for JSONB, will parse in app
  suggestions?: Array<{ title: string; description: string; example: string }>; -- Changed to object array for JSONB
  conflicts?: Array<{ issue: string; resolution: string }>; -- Changed to object array for JSONB
  alternatives?: string[]; -- Changed to string[] for JSONB
  review_timestamp: string; -- Renamed from created_at
}

export interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  comment_text: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  openai_api_key?: string;
  preferred_model?: string;
  ai_enabled: boolean;
  theme?: string; -- Added
  timezone?: string; -- Added
  updated_at: string;
}

export interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  updated_at: string;
}