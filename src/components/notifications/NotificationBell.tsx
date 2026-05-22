"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPopover } from "./NotificationPopover";
import { Button } from "@/components/ui/button";

export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications();

  return (
    <NotificationPopover notifications={notifications} unreadCount={unreadCount}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.3, 1] }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute -top-1 -right-1 flex h-4 w-4 min-w-[1rem] items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </NotificationPopover>
  );
}
