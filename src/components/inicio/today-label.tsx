"use client";

import { useEffect, useState } from "react";

/**
 * Igual que Greeting: la fecha se calcula en el cliente porque el reloj
 * del servidor (UTC en Vercel) no es el de un visitante en Centroamérica —
 * a las 7 p.m. en Guatemala ya es "mañana" en UTC.
 */
export function TodayLabel() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(
      new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" }),
    );
  }, []);

  return <>{label}</>;
}
