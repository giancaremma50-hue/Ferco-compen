import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getRejectionReasonsAdmin } from "@/lib/rejection-reasons/get-rejection-reasons-admin";
import { RejectionReasonRow } from "@/components/configuracion/rejection-reason-row";
import { AddRejectionReasonForm } from "@/components/configuracion/add-rejection-reason-form";

export default async function MotivosRechazoPage() {
  const profile = await requireAdminOrAbove();
  const reasons = await getRejectionReasonsAdmin(profile.organization_id);

  return (
    <section className="border border-border bg-card p-5">
      <h2 className="font-serif text-2xl">Motivos de rechazo</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Un motivo desactivado deja de ofrecerse, pero las postulaciones ya rechazadas con él lo siguen mostrando.
      </p>

      <div className="mt-5">
        <AddRejectionReasonForm />
      </div>

      <div className="mt-6">
        {reasons.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Todavía no hay motivos configurados.</p>
        ) : (
          reasons.map((r) => <RejectionReasonRow key={r.id} reason={r} />)
        )}
      </div>
    </section>
  );
}
