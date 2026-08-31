import Image from "next/image";
import { getOrganization } from "@/lib/organizations/get-organization";
import { signInWithGoogle } from "@/lib/auth/actions";
import { ActionButton } from "@/components/ui/action-button";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string | string[] }>;
}) {
  const { proximo } = await searchParams;
  const organization = await getOrganization();

  const platformName = organization?.platform_name ?? "Reclutamiento";
  const signIn = signInWithGoogle.bind(null, proximo);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-8 py-12 lg:px-20">
        <div className="flex items-center gap-2.5">
          {organization?.logo_url ? (
            <Image src={organization.logo_url} alt="" width={24} height={24} className="object-contain" />
          ) : (
            <div className="flex size-7 items-center justify-center border border-foreground">
              <span className="font-serif text-[18px] leading-none">{platformName.charAt(0)}</span>
            </div>
          )}
          <span className="font-serif text-xl">{platformName}</span>
        </div>

        <div className="max-w-[400px]">
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Reclutamiento</p>
          <h1 className="font-serif mt-4 text-[44px] leading-[1.08]">Bienvenido de vuelta</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Entra con tu cuenta corporativa. No hay contraseñas que recordar ni que perder.
          </p>

          <form action={signIn} className="mt-10">
            <ActionButton
              variant="secondary"
              pendingLabel="Conectando…"
              className="w-full border-foreground"
            >
              <GoogleIcon />
              Entrar con Google
            </ActionButton>
          </form>

          {organization?.allowed_email_domain && (
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              Solo se admiten cuentas del dominio corporativo.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Conexión cifrada · {platformName}</p>
      </div>

      <div className="relative hidden overflow-hidden bg-accent lg:flex lg:flex-col lg:justify-end lg:p-14">
        {organization?.login_image_url && (
          <Image
            src={organization.login_image_url}
            alt=""
            fill
            className="object-cover"
            priority
          />
        )}
        <blockquote className="font-serif relative z-10 max-w-[460px] text-[32px] leading-[1.3] text-accent-foreground">
          Contratar bien es la decisión más cara que toma una empresa.
        </blockquote>
      </div>
    </main>
  );
}
