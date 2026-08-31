import { redirect } from "next/navigation";

// proxy.ts ya redirige a /login cualquier visita a "/" sin sesión (no está
// en PUBLIC_PATHS), así que este componente solo se ejecuta autenticado.
// Si el perfil no existe, requireProfile() en /inicio maneja ese caso.
export default function Home() {
  redirect("/inicio");
}
