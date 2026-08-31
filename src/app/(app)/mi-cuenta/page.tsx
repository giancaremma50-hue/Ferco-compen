import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PREFERENCE_TYPES, NOTIFICATION_TYPE_LABEL } from "@/lib/notifications/preferences-schema";
import { PreferenceRow } from "@/components/notificaciones/preference-row";

export default async function MiCuentaPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("type, in_app, email")
    .eq("profile_id", profile.id);

  const byType = new Map((preferences ?? []).map((p) => [p.type, p]));

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
    </div>
  );
}
