export type Classification = {
  sentimiento: number;
  etiquetas: string[];
  resumen: string | null;
  urgencia: number;
  confianza: number;
  temas?: string[];
};

export type Target = {
  id: string;
  nombre: string;
  aliases: string[];
};

export type Mention = {
  id: string;
  text: string;
  url: string | null;
  author_handle: string | null;
  source: string;
  published_at: string;
  reach_score: number;
  tipo_fuente: string;
  target_name?: string;
  classifications: Classification | Classification[] | null;
};

export type DashboardStats = {
  target_id: string | null;
  target_name: string;
  targets: Target[];
  total_mentions: number;
  mentions_24h: number;
  avg_sentimiento: number;
  urgent_count: number;
  review_queue: number;
  by_source: Record<string, number>;
  by_target: Record<string, number>;
};
