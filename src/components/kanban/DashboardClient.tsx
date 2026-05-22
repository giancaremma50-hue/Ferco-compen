"use client";

import { useState } from "react";
import { Users, LayoutGrid } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { RequestCardGrid } from "@/components/requests/RequestCardGrid";
import { useRequests } from "@/hooks/useRequests";
import { useAuth } from "@/context/AuthContext";

export function DashboardClient() {
  const { userProfile } = useAuth();
  const { myRequests, teamRequests, hasTeam, loading } = useRequests();
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");
  const isAdmin = userProfile?.role === "administrador";

  // ── Admins: full Kanban board (drag-and-drop, all requests) ──────────────
  if (isAdmin) {
    return <KanbanBoard mode="my" />;
  }

  // ── Collaborators without direct reports: simple card grid ────────────────
  if (!hasTeam) {
    return (
      <div className="p-6">
        <RequestCardGrid requests={myRequests} loading={loading} />
      </div>
    );
  }

  // ── Managers: two tabs, each with a card grid ─────────────────────────────
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
        />
        <TabButton
          active={activeTab === "team"}
          onClick={() => setActiveTab("team")}
          icon={<Users className="h-3.5 w-3.5" />}
          label={`Mi equipo${teamRequests.length > 0 ? ` (${teamRequests.length})` : ""}`}
        />
      </div>

      <div className="p-6">
        {activeTab === "my" ? (
          <RequestCardGrid requests={myRequests} loading={loading} />
        ) : (
          <RequestCardGrid
            requests={teamRequests}
            loading={loading}
            showCreator
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
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
