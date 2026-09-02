import Image from "next/image";
import Link from "next/link";
import { getOrganization } from "@/lib/organizations/get-organization";

export default async function EmpleosLayout({ children }: { children: React.ReactNode }) {
  const organization = await getOrganization();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-6">
          <Link href="/empleos" className="flex items-center gap-2.5">
            {organization?.logo_url && (
              <Image src={organization.logo_url} alt="" width={28} height={28} className="rounded-sm" />
            )}
            <span className="font-serif text-lg">{organization?.platform_name ?? "Atrio"}</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
