"use client";

import { useState, useTransition } from "react";
import { updatePreference } from "@/lib/notifications/preferences-actions";
import { notifyError } from "@/lib/notifications/toast";
import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export function PreferenceRow({
  type,
  label,
  inApp,
  email,
}: {
  type: NotificationType;
  label: string;
  inApp: boolean;
  email: boolean;
}) {
  const [inAppValue, setInAppValue] = useState(inApp);
  const [emailValue, setEmailValue] = useState(email);
  const [, startTransition] = useTransition();

  function handleToggle(channel: "in_app" | "email", checked: boolean) {
    const previous = channel === "in_app" ? inAppValue : emailValue;
    if (channel === "in_app") setInAppValue(checked);
    else setEmailValue(checked);

    startTransition(async () => {
      const result = await updatePreference(type, channel, checked);
      if (result.error) {
        if (channel === "in_app") setInAppValue(previous);
        else setEmailValue(previous);
        notifyError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3.5 text-sm last:border-b-0">
      <span>{label}</span>
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={inAppValue}
            onChange={(e) => handleToggle("in_app", e.target.checked)}
            className="size-3.5"
          />
          In-app
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={emailValue}
            onChange={(e) => handleToggle("email", e.target.checked)}
            className="size-3.5"
          />
          Correo
        </label>
      </div>
    </div>
  );
}
