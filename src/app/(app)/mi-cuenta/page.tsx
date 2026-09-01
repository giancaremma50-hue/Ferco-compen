import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PREFERENCE_TYPES, NOTIFICATION_TYPE_LABEL } from "@/lib/notifications/preferences-schema";
import { PreferenceRow } from "@/components/notificaciones/preference-row";
import { getMyErrorReports } from "@/lib/errors/get-error-reports";
import { ERROR_STATUS_LABEL } from "@/lib/errors/schema";

export default async function MiCuentaPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("type, in_app, email")
    .eq("profile_id", profile.id);

  const byType = new Map((preferences ?? []).map((p) => [p.type, p]));
  const myReports = await getMyErrorReports(profile.id, profile.organization_id);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-[32px]">Mi cuenta</h1>
      <p className="mt-1 text-sm text-muted-foreground">{profile.display_name} · {profile.email}</p>

      <section className="mt-10">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Notificaciones</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Elige por qué canal quieres enterarte de cada tipo de aviso.
        </p>
        <div className="mt-5 border border-border bg-card px-4">
          {PREFERENCE_TYPES.map((type) => {
            const pref = byType.get(type);
            return (
              <PreferenceRow
                key={type}
                type={type}
                label={NOTIFICATION_TYPE_LABEL[type]}
                inApp={pref?.in_app ?? true}
                email={pref?.email ?? true}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Mis reportes</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Lo que le has contado al soporte, y sus respuestas.</p>
        {myReports.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Todavía no le has reportado nada al soporte. Cuando algo se rompa, usa «Contarle al soporte» en la
            pantalla de error y aparecerá aquí.
          </p>
        ) : (
          <div className="mt-5 border border-border bg-card">
            {myReports.map((r) => (
              <Link
                key={r.id}
                href={`/mi-cuenta/reportes/${r.id}`}
                className="flex items-center justify-between gap-4 border-b border-border/60 p-4 last:border-b-0 hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">«{r.user_message}»</p>
                </div>
                <div className="flex-none text-right">
                  <p className="text-xs text-muted-foreground">{ERROR_STATUS_LABEL[r.status]}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
