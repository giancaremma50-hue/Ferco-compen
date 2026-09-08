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
            <span className="font-serif text-lg">{organization?.platform_name ?? "Demo AJE"}</span>
          </Link>
        </div>
      </header>
      {children}

      {/* El enlace legal tiene que estar alcanzable desde cualquier pantalla
          del portal, no solo desde el formulario. */}
      <footer className="mt-16 border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {organization?.platform_name ?? "Demo AJE"}
          </span>
          <Link href="/privacidad" className="font-medium underline">
            Política de privacidad y tratamiento de datos
          </Link>
        </div>
      </footer>
    </div>
  );
}
