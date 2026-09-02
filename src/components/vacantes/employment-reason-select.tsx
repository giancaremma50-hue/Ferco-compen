"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createEmploymentReason } from "@/lib/employment-reasons/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { EmploymentReasonOption } from "@/lib/employment-reasons/get-employment-reasons";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

/**
 * Lista con alta inline — "mantengamos la opción de lista con la opción de
 * agregar nuevos motivos desde esa lista desplegable" (decisión del
 * usuario). No es un combobox de autocompletar: un botón "+" revela un
 * input de texto chico; "Agregar" invoca la Server Action directo (sin un
 * <form> anidado — este componente vive DENTRO del form de crear vacante,
 * y HTML no permite <form> dentro de <form>), y al guardar agrega la
 * opción a la lista local y la deja seleccionada.
 *
 * El input de texto necesita su propio manejo de Enter: al vivir dentro del
 * <form> de crear vacante, sin esto Enter dispara el envío IMPLÍCITO de ese
 * form entero (el botón "Agregar" de acá es type="button", así que el
 * navegador usa el submit real del form — "Crear vacante" — como default).
 */
export function EmploymentReasonSelect({ initialReasons }: { initialReasons: EmploymentReasonOption[] }) {
  const [reasons, setReasons] = useState(initialReasons);
  const [selected, setSelected] = useState("");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (newLabel.trim().length < 2) return;
    const formData = new FormData();
    formData.set("label", newLabel);
    startTransition(async () => {
      const result = await createEmploymentReason(undefined, formData);
      if (result.error) {
        notifyError(result.error);
        return;
      }
      if (result.id && result.label) {
        setReasons((prev) => [...prev, { id: result.id!, label: result.label! }].sort((a, b) => a.label.localeCompare(b.label)));
        setSelected(result.id);
        notifySuccess("Motivo agregado");
      }
      setNewLabel("");
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        name="employment_reason_id"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className={FIELD_CLASS}
      >
        <option value="">Sin especificar</option>
        {reasons.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            autoFocus
            maxLength={80}
            placeholder="Nombre del motivo nuevo"
            className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
          <ActionButton
            type="button"
            variant="secondary"
            pending={isPending}
            pendingLabel="Agregando…"
            onClick={handleAdd}
            disabled={newLabel.trim().length < 2}
            className="h-9 px-3 text-xs"
          >
            Agregar
          </ActionButton>
          <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-md px-2 text-xs text-muted-foreground">
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent"
        >
          <Plus className="size-3.5" aria-hidden />
          Agregar motivo nuevo
        </button>
      )}
    </div>
  );
}
