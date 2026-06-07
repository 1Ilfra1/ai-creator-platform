import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ADMIN_EMAIL = "frants1illia@gmail.com";

export async function requireAdminUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return {
      user: null,
      error: "Unauthorized",
      status: 401,
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user || user.email !== ADMIN_EMAIL) {
    return {
      user: null,
      error: "Forbidden",
      status: 403,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}
