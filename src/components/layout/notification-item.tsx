"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { markAsRead } from "@/lib/notifications/mark-read-actions";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/get-notifications";

export function NotificationItem({
  item,
  onRead,
}: {
  item: NotificationItemType;
  onRead?: () => void;
}) {
  const [, startTransition] = useTransition();
  const isUnread = !item.readAt;

  function handleClick() {
    if (!isUnread) return;
    onRead?.();
    startTransition(() => markAsRead(item.id));
  }

  const content = (
    <div className="flex gap-2.5 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <span
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${isUnread ? "bg-accent" : "bg-transparent"}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-medium">{item.title}</p>
        <p className="mt-0.5 truncate text-muted-foreground">{item.body}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })}
        </p>
      </div>
    </div>
  );

  if (item.url) {
    return (
      <Link href={item.url} onClick={handleClick} className="block hover:bg-background">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full text-left hover:bg-background">
      {content}
    </button>
  );
}
