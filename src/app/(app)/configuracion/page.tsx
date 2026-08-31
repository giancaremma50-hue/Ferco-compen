import { redirect } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";

export default async function ConfiguracionIndexPage() {
  const profile = await requireAdminOrAbove();
  redirect(profile.role === "super_admin" ? "/configuracion/marca" : "/configuracion/usuarios");
}
