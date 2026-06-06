export interface User {
  id: number;
  username: string;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  video_filename?: string;
  thumbnail_filename?: string;
  video_url?: string;
  thumbnail_url?: string;
  uploaded_at: string;
  user_id: number | null;
  author_name: string | null;

  // YouTube / Twitch additions
  type?: "youtube" | "twitch" | "local";
  views?: number;
  game_name?: string;
  channel_name?: string;
  embed_url?: string;
}
