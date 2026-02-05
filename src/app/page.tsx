import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/server";

export default async function Home() {
  const supabase = await createClient();

  const user = await getAuthenticatedUser(supabase);

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
