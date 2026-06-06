export interface User {
  id: number;
  username: string;
}

export interface Video {
  id: number;
  title: string;
  description: string;
  video_filename: string;
  thumbnail_filename: string;
  uploaded_at: string;
  user_id: number | null;
  author_name: string | null;
}
