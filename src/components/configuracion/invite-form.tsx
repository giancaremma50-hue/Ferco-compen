"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvite } from "@/lib/users/invite-actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ASSIGNABLE_ROLES, DEFAULT_ROLE, ROLE_LABEL } from "@/lib/auth/role-labels";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Invitar por correo es la excepción al filtro de dominio corporativo (ver
 * auth/callback/route.ts): sirve para dar de alta a alguien que todavía no
 * tiene cuenta y cuyo correo no es del dominio permitido — el rol se le
 * asigna solo en cuanto entra la primera vez con Google.
 */
export function InviteForm() {
  const [state, formAction] = useActionState(createInvite, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2.5">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="invite-email" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Correo a invitar
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="nombre@correo.com"
          aria-invalid={state?.field === "email"}
          className={`h-10 rounded-md border bg-background px-3 text-sm ${state?.field === "email" ? "border-destructive" : "border-border"}`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-role" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Rol
        </label>
        <select
          id="invite-role"
          name="role"
          defaultValue={DEFAULT_ROLE}
          className="h-10 rounded-md border border-border bg-background px-2 text-sm"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <ActionButton variant="secondary" className="h-10 px-4 text-xs">
        Invitar
      </ActionButton>
    </form>
  );
}
