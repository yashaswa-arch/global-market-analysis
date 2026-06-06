export interface Event {
  id: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  published_at?: string;
  created_at?: string;
}

export interface Analysis {
  id: string;
  event_id: string;
  summary?: string;
  sentiment?: string;
  importance_score?: number;
  key_points: string[];
  category?: string;
  created_at?: string;
}

export interface EventWithAnalysis extends Event {
  analysis?: Analysis;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: string;
  message: string;
  created_at?: string;
}
