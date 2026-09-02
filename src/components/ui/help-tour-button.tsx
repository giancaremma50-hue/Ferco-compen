"use client";

import { HelpCircle } from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export type HelpTourStep = { selector: string; title: string; description: string };

/**
 * A diferencia de OnboardingTour (se dispara solo una vez, en el primer
 * login, y apunta al menú), este es a demanda: el usuario lo abre cuando
 * quiere, tantas veces como quiera, dentro de una página con contenido más
 * denso (el wizard de plantilla, "Nueva vacante") — no tiene sentido
 * forzarlo una sola vez si la persona vuelve a esta pantalla en 3 meses y
 * ya no se acuerda de nada.
 */
export function HelpTourButton({ intro, steps }: { intro?: { title: string; description: string }; steps: HelpTourStep[] }) {
  function start() {
    const found = steps.filter((s) => document.querySelector(s.selector)).map((s) => ({
      element: s.selector,
      popover: { title: s.title, description: s.description },
    }));
    if (found.length === 0) return;

    const tour = driver({
      showProgress: true,
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Listo",
      steps: intro ? [{ popover: intro }, ...found] : found,
    });
    tour.drive();
  }

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
    >
      <HelpCircle className="size-3.5" aria-hidden />
      ¿Cómo funciona esto?
    </button>
  );
}
