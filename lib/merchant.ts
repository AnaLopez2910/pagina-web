import { createClient } from "@/lib/supabase/server";
import type { StoreRow } from "@/types/database";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getMerchantStore() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data } = await supabase.from("stores").select("*").eq("owner_id", userData.user.id).maybeSingle();
  return (data as StoreRow | null) ?? null;
}

export async function getMerchantContext() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { supabase, user: null, store: null };

  const { data } = await supabase.from("stores").select("*").eq("owner_id", userData.user.id).maybeSingle();
  return { supabase, user: userData.user, store: (data as StoreRow | null) ?? null };
}
