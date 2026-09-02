const STEPS = [
  { n: 1, label: "Detalles" },
  { n: 2, label: "Candidatura" },
  { n: 3, label: "Preguntas" },
  { n: 4, label: "Etapas" },
  { n: 5, label: "Permisos y usos" },
  { n: 6, label: "Cierre" },
];

/**
 * Solo lectura por ahora: el wizard es estrictamente secuencial (sin salto
 * libre), así que ningún paso salvo el actual y los ya completados es un
 * link — y hasta que existan los pasos 2-6 (Fase 18, siguientes entregas),
 * tampoco hay a dónde saltar.
 */
export function WizardStepsNav({ current }: { current: number }) {
  return (
    <nav aria-label="Pasos de la plantilla" className="flex flex-col gap-1">
      {STEPS.map((step) => {
        const state = step.n === current ? "current" : step.n < current ? "done" : "upcoming";
        return (
          <div key={step.n} className="flex items-center gap-3 py-2">
            <span
              aria-hidden
              className={`flex size-6 flex-none items-center justify-center rounded-full border text-[11px] tabular-nums ${
                state === "current"
                  ? "border-foreground bg-foreground font-medium text-background"
                  : state === "done"
                    ? "border-accent text-accent"
                    : "border-border text-muted-foreground"
              }`}
            >
              {step.n}
            </span>
            <span
              className={`text-[13px] ${state === "current" ? "font-medium text-foreground" : "text-muted-foreground"}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
