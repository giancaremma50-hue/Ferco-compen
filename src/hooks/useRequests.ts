"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where, orderBy, getDocs } from "firebase/firestore";
import { requestsCol, usersCol } from "@/lib/firebase/firestore";
import { Request, Stage } from "@/types";
import { useAuth } from "@/context/AuthContext";

export function useRequests() {
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [teamRequests, setTeamRequests] = useState<Request[]>([]);
  const [hasTeam, setHasTeam] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile) return;

    // Capture in a const so TypeScript knows it's non-null inside the async closure
    const profile = userProfile;

    let unsubscribeA: (() => void) | null = null;
    let unsubscribeB: (() => void) | null = null;
    let cancelled = false;

    async function setup() {
      if (profile.role === "administrador") {
        // Admin: see every request
        const q = query(requestsCol(), orderBy("createdAt", "desc"));
        unsubscribeA = onSnapshot(q, (snap) => {
          if (cancelled) return;
          setMyRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request)));
          setTeamRequests([]);
          setHasTeam(false);
          setLoading(false);
        });
        return;
      }

      // Collaborator: check who reports directly to this user
      const reportsSnap = await getDocs(
        query(usersCol(), where("managerId", "==", profile.uid))
      );
      if (cancelled) return;

      const directReportUids = reportsSnap.docs.map((d) => d.id);
      const isManager = directReportUids.length > 0;
      setHasTeam(isManager);

      // Track when both listeners have emitted at least once
      let myLoaded = false;
      let teamLoaded = !isManager; // no team → team is trivially "loaded"

      function checkBothLoaded() {
        if (myLoaded && teamLoaded) setLoading(false);
      }

      // Listener A — own requests
      unsubscribeA = onSnapshot(
        query(
          requestsCol(),
          where("createdBy", "==", profile.uid),
          orderBy("createdAt", "desc")
        ),
        (snap) => {
          if (cancelled) return;
          setMyRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request)));
          myLoaded = true;
          checkBothLoaded();
        }
      );

      // Listener B — direct reports' requests (only when user has a team)
      if (isManager) {
        unsubscribeB = onSnapshot(
          query(
            requestsCol(),
            where("createdBy", "in", directReportUids),
            orderBy("createdAt", "desc")
          ),
          (snap) => {
            if (cancelled) return;
            setTeamRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Request)));
            teamLoaded = true;
            checkBothLoaded();
          }
        );
      }
    }

    setup().catch((err) => {
      console.error("[useRequests] setup error:", err);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribeA?.();
      unsubscribeB?.();
    };
  }, [userProfile]);

  const myByStage = (stage: Stage) => myRequests.filter((r) => r.stage === stage);
  const teamByStage = (stage: Stage) => teamRequests.filter((r) => r.stage === stage);

  // Backward-compatibility alias — existing KanbanBoard calls byStage()
  const byStage = myByStage;

  return {
    requests: myRequests,   // backward compat
    myRequests,
    teamRequests,
    byStage,                // backward compat alias
    myByStage,
    teamByStage,
    hasTeam,
    loading,
  };
}
