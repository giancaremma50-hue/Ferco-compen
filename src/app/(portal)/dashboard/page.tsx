import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tablero</h1>
          <p className="text-sm text-muted-foreground">
            Solicitudes de compensación en curso
          </p>
        </div>
        <Link
          href={ROUTES.NUEVA_SOLICITUD}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          + Nueva solicitud
        </Link>
      </div>

      <KanbanBoard />
    </div>
  );
}
