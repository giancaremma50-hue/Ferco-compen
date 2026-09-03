"use client";

import { useTransition } from "react";
import { updateUserRole, toggleUserActive } from "@/lib/users/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/lib/auth/role-labels";
import { ActionButton } from "@/components/ui/action-button";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function UserRow({
  user,
  isSelf,
  canAssignSuperAdmin,
}: {
  user: { id: string; display_name: string; email: string; role: AppRole; is_active: boolean };
  isSelf: boolean;
  canAssignSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // Un admin normal no puede tocar la cuenta de un super admin — ni verla
  // editable ni asignarle ese rol a alguien más. El select siempre incluye
  // el rol real de la fila para que nunca muestre un valor falso.
  const canEditThisUser = !isSelf && !(user.role === "super_admin" && !canAssignSuperAdmin);
  // Solo roles asignables (lista blanca), más el rol REAL de esta fila si es
  // uno que ya no se asigna: sin eso, un perfil heredado con un rol retirado
  // mostraría el primer valor de la lista, un dato falso sobre esa persona.
  const visibleOptions = ASSIGNABLE_ROLES.filter(
    (r) => r !== "super_admin" || canAssignSuperAdmin || user.role === "super_admin",
  ).map((value) => ({ value: value as AppRole, label: ROLE_LABEL[value] }));
  if (!visibleOptions.some((r) => r.value === user.role)) {
    visibleOptions.unshift({ value: user.role, label: ROLE_LABEL[user.role] });
  }

  function handleRoleChange(role: AppRole) {
    startTransition(async () => {
      const result = await updateUserRole(user.id, role);
      if (result.error) notifyError(result.error);
      else notifySuccess(`Rol actualizado a ${ROLE_LABEL[role]}`);
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleUserActive(user.id, !user.is_active);
      if (result.error) notifyError(result.error);
      else notifySuccess(user.is_active ? "Usuario desactivado" : "Usuario activado");
    });
  }

  return (
    // En celular se apila (persona / rol / estado, cada uno en su línea) —
    // 180px + 120px de columnas fijas nunca caben junto al nombre en un
    // teléfono. Desde `sm` vuelve a ser la fila de 3 columnas de escritorio.
    <div className="grid grid-cols-1 gap-2 border-b border-border px-1 py-3.5 text-sm sm:grid-cols-[1fr_180px_120px] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{user.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <select
        value={user.role}
        disabled={!canEditThisUser || pending}
        onChange={(e) => handleRoleChange(e.target.value as AppRole)}
        className="h-9 rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50"
      >
        {visibleOptions.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <ActionButton
        type="button"
        variant={user.is_active ? "secondary" : "primary"}
        disabled={!canEditThisUser}
        pending={pending}
        pendingLabel={user.is_active ? "Desactivando…" : "Activando…"}
        onClick={handleToggleActive}
        className="h-9 px-3 text-xs"
      >
        {user.is_active ? "Activo" : "Inactivo"}
      </ActionButton>
    </div>
  );
}
