import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getDepartmentsAdmin, getProfilesForSelect } from "@/lib/departments/get-departments-admin";
import { deleteDepartment } from "@/lib/departments/actions";
import { DepartmentDialog } from "@/components/configuracion/department-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { ActionButton } from "@/components/ui/action-button";

export default async function DepartamentosPage() {
  const profile = await requireAdminOrAbove();
  const [departments, profiles] = await Promise.all([
    getDepartmentsAdmin(profile.organization_id),
    getProfilesForSelect(profile.organization_id),
  ]);

  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-serif text-2xl">Departamentos</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{departments.length} departamentos.</p>
        </div>
        <DepartmentDialog
          profiles={profiles}
          trigger={<ActionButton type="button">Agregar departamento</ActionButton>}
        />
      </div>

      {departments.length === 0 ? (
        <p className="p-8 text-sm text-muted-foreground">
          Todavía no hay departamentos. Agrega el primero con el botón de arriba.
        </p>
      ) : (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-[1fr_140px_180px_160px] gap-4 border-b border-border px-1 py-2.5 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            <span>Nombre</span>
            <span>País</span>
            <span>Responsable</span>
            <span />
          </div>
          {departments.map((d) => (
            <div key={d.id} className="grid grid-cols-[1fr_140px_180px_160px] items-center gap-4 border-b border-border/60 px-1 py-3 text-sm">
              <span>{d.name}</span>
              <span className="text-muted-foreground">{d.country ?? "—"}</span>
              <span className="text-muted-foreground">{d.head?.display_name ?? "—"}</span>
              <div className="flex justify-end gap-2">
                <DepartmentDialog
                  department={d}
                  profiles={profiles}
                  trigger={
                    <button type="button" className="text-xs text-muted-foreground underline">
                      Editar
                    </button>
                  }
                />
                <DeleteButton
                  itemLabel={`el departamento "${d.name}"`}
                  iconOnly
                  onDelete={() => deleteDepartment(d.id)}
                  successMessage="Departamento eliminado"
                  confirmDescription="Las vacantes que lo usan quedarán sin departamento asignado."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
