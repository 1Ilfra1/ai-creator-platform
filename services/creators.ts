import { supabase } from "@/lib/supabase";
import { PublicCreator } from "@/types/creator";

export async function getCreators(): Promise<PublicCreator[]> {
  const { data, error } = await supabase
    .from("public_creators")
    .select("id, username, display_name, tagline, bio, tags, topics, profile_image, banner_image, intro_audio, is_active, is_published")
    .eq("is_active", true)
    .eq("is_published", true);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}
