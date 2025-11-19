import { Database } from '../../database.types';

export type Project = Database['public']['Tables']['projects']['Row'];
export type Phase = Database['public']['Tables']['phases']['Row'];
export type Step = Database['public']['Tables']['steps']['Row']; // Added Step type
export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentVersion = Database['public']['Tables']['document_versions']['Row'];
export type AiReview = Database['public']['Tables']['ai_reviews']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];