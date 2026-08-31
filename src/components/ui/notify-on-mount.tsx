"use client";

import { useEffect } from "react";
import { notifySuccess } from "@/lib/notifications/toast";

/** Dispara un toast de éxito una vez montado — para confirmar una acción que redirigió a otra página. */
export function NotifyOnMount({ message }: { message: string }) {
  useEffect(() => {
    notifySuccess(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, no en cada cambio de `message`.
  }, []);
  return null;
}
