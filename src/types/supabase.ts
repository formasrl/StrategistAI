export interface Project {
  id: string;
  user_id: string;
  name: string;
  business_type?: string;
  timeline?: string;
  created_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completion_percentage: number;
  created_at: string;
}

export interface Step {
  id: string;
  phase_id: string;
  step_number: number;
  step_name: string;
  description?: string;
  why_matters?: string;
  dependencies?: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  step_id: string;
  document_name: string;
  content?: string;
  status: 'draft' | 'in_review' | 'approved';
  current_version: number;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content?: string;
  version: number;
  change_description?: string;
  created_at: string;
}

export interface AiReview {
  id: string;
  document_id: string;
  strengths?: string;
  suggestions?: string;
  conflicts?: string;
  alternatives?: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  openai_api_key?: string;
  preferred_model?: string;
  ai_enabled: boolean;
  updated_at: string;
}

export interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  updated_at: string;
}