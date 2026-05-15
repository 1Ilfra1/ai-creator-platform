import { supabase } from "@/lib/supabase";

export async function getCreators() {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("is_active", true)
    .eq("is_published", true);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}