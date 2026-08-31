"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "./notification-item";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/get-notifications";

type NotificationRow = {
  id: string;
  type: NotificationItemType["type"];
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({
  profileId,
  initialItems,
  initialUnreadCount,
}: {
  profileId: string;
  initialItems: NotificationItemType[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((current) =>
            [
              {
                id: row.id,
                type: row.type,
                title: row.title,
                body: row.body,
                url: row.url,
                readAt: row.read_at,
                createdAt: row.created_at,
              },
              ...current,
            ].slice(0, 8),
          );
          setUnreadCount((count) => count + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  function handleItemRead(id: string) {
    setItems((current) =>
      current.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 border border-border bg-card">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin notificaciones todavía.</p>
            ) : (
              items.map((item) => (
                <NotificationItem key={item.id} item={item} onRead={() => handleItemRead(item.id)} />
              ))
            )}
          </div>
          <a
            href="/notificaciones"
            className="block border-t border-border p-3 text-center text-xs text-accent underline"
          >
            Ver todas
          </a>
        </div>
      )}
    </div>
  );
}
