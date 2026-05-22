"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where, orderBy } from "firebase/firestore";
import { requestsCol } from "@/lib/firebase/firestore";
import { Request, Stage } from "@/types";
import { useAuth } from "@/context/AuthContext";

export function useRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile) return;

    let q;
    if (userProfile.role === "administrador") {
      q = query(requestsCol(), orderBy("createdAt", "desc"));
    } else {
      q = query(
        requestsCol(),
        where("createdBy", "==", userProfile.uid),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request));
      setRequests(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  const byStage = (stage: Stage) => requests.filter((r) => r.stage === stage);

  return { requests, byStage, loading };
}
