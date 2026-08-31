import { toast } from "sonner";

/** Toda acción exitosa confirma con un mensaje concreto — nunca "Éxito". */
export function notifySuccess(message: string, description?: string) {
  toast.success(message, { description });
}

export function notifyError(message: string, description?: string) {
  toast.error(message, { description });
}
