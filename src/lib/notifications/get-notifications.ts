import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type NotificationItem = {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapRow(r: {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}): NotificationItem {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    url: r.url,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export async function getRecentNotifications(limit = 8): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRow);
}

export async function getAllNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(mapRow);
}
