import Link from "next/link";
import { getErrorEntry } from "@/lib/errors/catalog";
import { signOut } from "@/lib/auth/actions";
import { ActionButton } from "@/components/ui/action-button";
import { ErrorCard } from "@/components/errors/error-card";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const entry = getErrorEntry(motivo);

  // "inactivo" y "fallo_inicio" pueden llegar con una sesión de Supabase
  // todavía válida (cuenta desactivada, o perfil ilegible tras el login).
  // El proxy rebota cualquier /login con sesión activa hacia /inicio, así
  // que el único escape real es cerrar sesión de verdad (Server Action),
  // no un link a /login. Llamar signOut() sin sesión no hace daño.
  const needsSignOut = motivo === "inactivo" || motivo === "fallo_inicio";

  return (
    <ErrorCard entry={entry}>
      {needsSignOut ? (
        <form action={signOut}>
          <ActionButton pendingLabel="Cerrando sesión…">Cerrar sesión</ActionButton>
        </form>
      ) : (
        <Link
          href="/login"
          className="inline-flex h-[42px] items-center justify-center rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Volver a intentar
        </Link>
      )}
    </ErrorCard>
  );
}
