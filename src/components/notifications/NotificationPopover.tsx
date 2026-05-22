"use client";

import { Notification } from "@/types";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { NotificationItem } from "./NotificationItem";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";

interface NotificationPopoverProps {
  notifications: Notification[];
  unreadCount: number;
  children: React.ReactNode;
}

export function NotificationPopover({
  notifications,
  unreadCount,
  children,
}: NotificationPopoverProps) {
  const { userProfile } = useAuth();

  async function handleMarkAllRead() {
    if (!userProfile) return;
    await markAllNotificationsRead(userProfile.uid);
  }

  async function handleRead(id: string) {
    await markNotificationRead(id);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notificaciones</span>
            {unreadCount > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: "var(--gold)" }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Marcar todo como leído
            </button>
          )}
        </div>

        <Separator />

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={handleRead} />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
