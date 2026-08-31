"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Se calcula en el cliente, no en el servidor: el reloj del servidor no es
 * el del visitante (Vercel corre en UTC, la organización opera en
 * Centroamérica). Arranca neutro para no desajustar la hidratación y se
 * ajusta justo después de montar.
 */
export function Greeting({ name }: { name: string }) {
  const [prefix, setPrefix] = useState("Hola");

  useEffect(() => {
    // No se puede calcular durante el render: el reloj del navegador no
    // existe en el servidor, así que esto tiene que ser un efecto por
    // definición — no hay nada que "sincronizar" antes de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefix(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <>
      {prefix}, {name}
    </>
  );
}
