export interface Creator {
  id: string;
  username: string;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  profile_image: string | null;
  banner_image: string | null;
  intro_audio: string | null;
  voice_id: string | null;
  tags: string[] | null;
  topics: string[] | null;
  personality_prompt: string | null;
  is_published: boolean;
}