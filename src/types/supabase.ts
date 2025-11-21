import { Database } from '../../database.types';

export type Project = Database['public']['Tables']['projects']['Row'];
export type Phase = Database['public']['Tables']['phases']['Row'];

// Manually extending Step to ensure new columns are available even if types aren't regenerated
// guiding_questions is JSONB in DB, but we treat it as string[] in the app
export type Step = Database['public']['Tables']['steps']['Row'] & {
  guiding_questions?: string[] | null;
  expected_output?: string | null;
};

export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentVersion = Database['public']['Tables']['document_versions']['Row'];
export type AiReview = Database['public']['Tables']['ai_reviews']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];

export type UserSettings = Database['public']['Tables']['user_settings']['Row'] & {
  onboarding_tour_completed?: boolean;
};

// Manually defining ProjectTemplate since the table might be new
export type ProjectTemplate = {
  id: string;
  name: string;
  description: string | null;
  structure: any; // Using any for the JSONB structure to allow flexibility (it contains phases/steps tree)
  created_at: string | null;
};

// Extend Document type to include step_embeddings for indexing status
export type DocumentWithEmbedding = Document & {
  step_embeddings?: Array<{ id: string }>;
};