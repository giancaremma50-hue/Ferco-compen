"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { notificationsCol } from "@/lib/firebase/firestore";
import { Notification } from "@/types";
import { useAuth } from "@/context/AuthContext";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      notificationsCol(),
      where("recipientId", "==", userProfile.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      setNotifications(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading };
}
