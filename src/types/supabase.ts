import { Database } from '../../database.types';

export type Project = Database['public']['Tables']['projects']['Row'] & {
  project_profile_summary: string | null;
};
export type Phase = Database['public']['Tables']['phases']['Row'];
export type Step = Database['public']['Tables']['steps']['Row'] & {
  updated_at: string | null;
};
export type Document = Database['public']['Tables']['documents']['Row'] & {
  summary: string | null;
  key_decisions: string[] | null;
  last_summarized_at: string | null;
};
export type DocumentVersion = Database['public']['Tables']['document_versions']['Row'];
export type AiReview = Database['public']['Tables']['ai_reviews']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type DocumentEmbedding = Database['public']['Tables']['document_embeddings']['Row'];