"use client";

import { deleteInvite } from "@/lib/users/invite-actions";
import { ROLE_LABEL } from "@/lib/auth/role-labels";
import { DeleteButton } from "@/components/ui/delete-button";
import type { PendingInvite } from "@/lib/users/get-invites";

export function InviteRow({ invite }: { invite: PendingInvite }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-1 py-3 text-sm last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{invite.email}</p>
        <p className="text-xs text-muted-foreground">Entrará como {ROLE_LABEL[invite.role]}</p>
      </div>
      <DeleteButton
        iconOnly
        itemLabel={`la invitación de ${invite.email}`}
        onDelete={() => deleteInvite(invite.id)}
        successMessage="Invitación eliminada"
        confirmDescription="Esa persona ya no entrará con ese rol asignado automáticamente."
      />
    </div>
  );
}
