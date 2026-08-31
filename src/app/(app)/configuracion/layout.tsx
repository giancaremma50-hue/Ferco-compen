import { requireAdminOrAbove } from "@/lib/auth/dal";
import { ConfigTabs } from "@/components/configuracion/config-tabs";

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdminOrAbove();

  return (
    <div>
      <h1 className="font-serif text-[38px] leading-tight">Configuración</h1>
      <div className="mt-5 mb-7">
        <ConfigTabs role={profile.role} />
      </div>
      {children}
    </div>
  );
}
