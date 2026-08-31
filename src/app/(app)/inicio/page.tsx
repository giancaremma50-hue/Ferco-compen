import { requireProfile } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/role-labels";
import { Greeting } from "@/components/inicio/greeting";
import { TodayLabel } from "@/components/inicio/today-label";

export default async function InicioPage() {
  const profile = await requireProfile();

  return (
    <div>
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
        <TodayLabel />
      </p>
      <h1 className="font-serif mt-2.5 text-[42px] leading-[1.1]">
        <Greeting name={profile.display_name.split(" ")[0]} />
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Entraste como <strong className="font-medium text-foreground">{ROLE_LABEL[profile.role]}</strong>.
        El tablero de vacantes y candidatos llega en la siguiente fase de construcción.
      </p>
    </div>
  );
}
