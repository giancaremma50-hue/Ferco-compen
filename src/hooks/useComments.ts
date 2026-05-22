"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy } from "firebase/firestore";
import { commentsCol } from "@/lib/firebase/firestore";
import { Comment } from "@/types";

export function useComments(requestId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;

    const q = query(commentsCol(requestId), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
      setComments(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [requestId]);

  const roots = comments.filter((c) => !c.parentId);
  const replies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId);

  return { comments, roots, replies, loading };
}
