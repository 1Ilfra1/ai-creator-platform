export interface Creator {
  id: string;
  display_name: string;
  bio: string;
  profile_image: string | null;
  banner_image: string | null;
  intro_audio: string | null;
  voice_id: string | null;
  tags: string[];
}