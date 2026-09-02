"use client";

import { useEffect, useState } from "react";

/**
 * Igual que Greeting: la fecha se calcula en el cliente porque el reloj
 * del servidor (UTC en Vercel) no es el del visitante — a última hora de
 * la tarde en una zona horaria detrás de UTC, el servidor ya cree que es
 * "mañana".
 */
export function TodayLabel() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(
      new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }),
    );
  }, []);

  return <>{label}</>;
}
