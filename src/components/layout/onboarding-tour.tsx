"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { markTutorialSeen } from "@/lib/profile/tutorial-actions";

/**
 * Los pasos se filtran por si el elemento existe en el DOM, no por rol —
 * FloatingNav ya decide qué ítems renderiza según el rol (máx. 5, ver
 * itemsForRole()); duplicar esa lógica aquí solo crearía una segunda fuente
 * de verdad que se desincroniza con el tiempo.
 */
const STEP_DEFS: { selector: string; title: string; description: string }[] = [
  { selector: '[data-tour="nav-inicio"]', title: "Inicio", description: "Un resumen rápido de tu actividad." },
  {
    selector: '[data-tour="nav-vacantes"]',
    title: "Vacantes",
    description: "Aquí ves las vacantes y puedes referir candidatos.",
  },
  {
    selector: '[data-tour="nav-candidatos"]',
    title: "Candidatos",
    description: "El pipeline de tus vacantes: arrastra candidatos entre etapas.",
  },
  {
    selector: '[data-tour="nav-configuracion"]',
    title: "Configuración",
    description: "Marca, usuarios y el centro de errores viven aquí.",
  },
  { selector: '[data-tour="bell"]', title: "Notificaciones", description: "Avisos en tiempo real de lo que te toca." },
  {
    selector: '[data-tour="mi-cuenta"]',
    title: "Mi cuenta",
    description: "Cambia tu foto de perfil y tus preferencias de notificación.",
  },
];

export function OnboardingTour({ hasSeenTutorial }: { hasSeenTutorial: boolean }) {
  useEffect(() => {
    if (hasSeenTutorial) return;

    const steps = STEP_DEFS.filter((s) => document.querySelector(s.selector)).map((s) => ({
      element: s.selector,
      popover: { title: s.title, description: s.description },
    }));
    if (steps.length === 0) return;

    const tour = driver({
      showProgress: true,
      nextBtnText: "Siguiente",
      prevBtnText: "Atrás",
      doneBtnText: "Listo",
      steps: [
        {
          popover: {
            title: "Bienvenido a Talento Ferco",
            description: "Un recorrido de un minuto antes de empezar. Puedes cerrarlo cuando quieras.",
          },
        },
        ...steps,
      ],
      // Se marca al cerrar el tour de cualquier forma (terminarlo o
      // saltarlo) — no solo al completar el último paso — para que a nadie
      // le vuelva a aparecer en su siguiente visita.
      onDestroyed: () => {
        markTutorialSeen();
      },
    });

    tour.drive();
  }, [hasSeenTutorial]);

  return null;
}
