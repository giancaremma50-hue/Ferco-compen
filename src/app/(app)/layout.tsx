import { requireProfile } from "@/lib/auth/dal";
import { getOrganization } from "@/lib/organizations/get-organization";
import { AppHeader } from "@/components/layout/app-header";
import { FloatingNav } from "@/components/layout/floating-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, organization] = await Promise.all([requireProfile(), getOrganization()]);

  return (
    <div className="min-h-screen">
      <AppHeader
        organization={organization ?? { platform_name: "Reclutamiento", logo_url: null }}
        profile={profile}
      />
      {/* pb calculado igual que el padding del propio FloatingNav (7rem +
          safe-area-inset-bottom) — con solo pb-28 el borde de la píldora en
          un iPhone con home indicator queda más alto que el aire reservado. */}
      <main className="mx-auto max-w-6xl px-6 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:px-10">
        {children}
      </main>
      <FloatingNav role={profile.role} />
    </div>
  );
}
