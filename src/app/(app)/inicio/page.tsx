import { requireProfile } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { getPendingApprovals, getMyRequests } from "@/lib/dashboard/get-inbox";
import { getFunnelData } from "@/lib/dashboard/get-funnel";
import { getTodayAgenda } from "@/lib/dashboard/get-agenda";
import { getRecruiterReport } from "@/lib/dashboard/get-recruiter-report";
import { Greeting } from "@/components/inicio/greeting";
import { TodayLabel } from "@/components/inicio/today-label";
import { PendingApprovalsInbox, MyRequestsInbox } from "@/components/inicio/inbox-panel";
import { FunnelKpis, FunnelKpiStrip } from "@/components/inicio/funnel-kpis";
import { TodayAgenda } from "@/components/inicio/today-agenda";
import { RecruiterReportSection } from "@/components/inicio/recruiter-report";

export default async function InicioPage() {
  const profile = await requireProfile();
  const isAdmin = ADMIN_ROLES.has(profile.role);
  // El embudo y la agenda ya se apoyan enteramente en lo que RLS deja ver a
  // cada rol (jobs_select_internal/applications_select) — no hay parámetro
  // de alcance que pasarles. El buzón sí cambia de forma según el rol (RH ve
  // pendientes por resolver con otra forma que "mis solicitudes" del
  // gestor), así que se resuelve en dos ramas separadas en vez de un solo
  // array de tipo mixto.
  const [pendingApprovals, myRequests, funnel, agenda, report] = await Promise.all([
    isAdmin ? getPendingApprovals() : Promise.resolve(null),
    isAdmin ? Promise.resolve(null) : getMyRequests(profile.id),
    getFunnelData(),
    getTodayAgenda(profile.id),
    isAdmin ? getRecruiterReport() : Promise.resolve(null),
  ]);

  return (
    <div>
      {/* Encabezado: saludo a la izquierda, cifras como tira de números a la
          derecha — quedan visibles sin robarle el primer lugar a la agenda,
          que es lo único accionable de esta pantalla (layout B). */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div>
          <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
            <TodayLabel />
          </p>
          <h1 className="font-serif mt-2.5 text-[38px] leading-[1.1] sm:text-[42px]">
            <Greeting name={profile.display_name.split(" ")[0]} />
          </h1>
        </div>
        {funnel && <FunnelKpiStrip data={funnel} />}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <TodayAgenda data={agenda} />

        {pendingApprovals ? (
          <PendingApprovalsInbox requests={pendingApprovals} />
        ) : (
          <MyRequestsInbox requests={myRequests ?? []} />
        )}

        {funnel && <FunnelKpis data={funnel} />}

        {report && <RecruiterReportSection report={report} />}
      </div>
    </div>
  );
}
