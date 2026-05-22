"use client";

import { useState } from "react";
import { Users, LayoutGrid, Archive } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { RequestCardGrid } from "@/components/requests/RequestCardGrid";
import { useRequests } from "@/hooks/useRequests";
import { useAuth } from "@/context/AuthContext";
import { Stage } from "@/types";

const ACTIVE_STAGES: Stage[] = ["en_analisis", "en_proceso_aprobacion"];
const HIST_STAGES:   Stage[] = ["finalizada", "cancelada_denegada"];

type Tab = "my" | "team" | "historial";

export function DashboardClient() {
  const { userProfile } = useAuth();
  const { myRequests, teamRequests, hasTeam, loading } = useRequests();
  const [activeTab, setActiveTab] = useState<Tab>("my");
  const isAdmin = userProfile?.role === "administrador";

  // ── Admins: full Kanban board (drag-and-drop, all requests) ──────────────
  if (isAdmin) {
    return <KanbanBoard mode="my" />;
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const activeMyRequests   = myRequests.filter((r) => ACTIVE_STAGES.includes(r.stage));
  const activeTeamRequests = teamRequests.filter((r) => ACTIVE_STAGES.includes(r.stage));

  // Historial = completed from own + team, newest first
  const histAllRequests = [
    ...myRequests.filter((r) => HIST_STAGES.includes(r.stage)),
    ...teamRequests.filter((r) => HIST_STAGES.includes(r.stage)),
  ].sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );

  // ── Collaborators & managers: tabs ────────────────────────────────────────
  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-border px-6"
      >
        <TabButton
          active={activeTab === "my"}
          onClick={() => setActiveTab("my")}
          icon={<LayoutGrid className="h-3.5 w-3.5" />}
          label="Mis solicitudes"
          count={activeMyRequests.length}
        />
        {hasTeam && (
          <TabButton
            active={activeTab === "team"}
            onClick={() => setActiveTab("team")}
            icon={<Users className="h-3.5 w-3.5" />}
            label="Mi equipo"
            count={activeTeamRequests.length}
          />
        )}
        <TabButton
          active={activeTab === "historial"}
          onClick={() => setActiveTab("historial")}
          icon={<Archive className="h-3.5 w-3.5" />}
          label="Historial"
          count={histAllRequests.length}
        />
      </div>

      <div className="p-6">
        {activeTab === "my" && (
          <RequestCardGrid requests={activeMyRequests} loading={loading} />
        )}
        {activeTab === "team" && hasTeam && (
          <RequestCardGrid
            requests={activeTeamRequests}
            loading={loading}
            showCreator
          />
        )}
        {activeTab === "historial" && (
          <RequestCardGrid
            requests={histAllRequests}
            loading={loading}
            showCreator={hasTeam}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium
        transition-colors duration-150 outline-none
        ${active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
        }
      `}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
          {count}
        </span>
      )}
      {/* Active underline */}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
          aria-hidden
        />
      )}
    </button>
  );
}
