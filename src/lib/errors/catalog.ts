/**
 * Redacción obligatoria: qué pasó en humano → qué no se perdió → qué puede
 * hacer ahora. Nunca culpar al usuario, nunca jerga, nunca un código sin
 * explicación. `reportable` habilita "Contarle al soporte" (Fase 7,
 * src/lib/errors/actions.ts) — solo para motivos donde ya existe un perfil
 * real al que atar el reporte.
 */
export type ErrorEntry = {
  titulo: string;
  mensaje: string;
  queHacer: string;
  reportable: boolean;
};

export const ERROR_CATALOG: Record<string, ErrorEntry> = {
  fallo_inicio: {
    titulo: "No pudimos iniciar tu sesión",
    mensaje: "Google no confirmó tu identidad esta vez. No perdiste nada.",
    queHacer: "Vuelve a intentarlo en unos segundos. Si se repite, contacta a tu administrador directamente.",
    // No reportable: puede ocurrir con una sesión de auth.users válida pero
    // SIN fila en profiles todavía — el reporte necesita organization_id/
    // reporter_id de un perfil real (Fase 7), así que no hay a quién
    // adjuntarlo. Si persiste, la única salida real es contactar a un admin.
    reportable: false,
  },
  inactivo: {
    titulo: "Tu cuenta está desactivada",
    mensaje: "Un administrador desactivó el acceso a esta cuenta.",
    queHacer: "Si crees que es un error, contacta a tu administrador.",
    reportable: false,
  },
  dominio_no_permitido: {
    titulo: "Este correo no pertenece a la organización",
    mensaje: "Solo se permite el acceso con cuentas del dominio corporativo.",
    queHacer: "Vuelve a intentarlo con tu correo de la empresa.",
    reportable: false,
  },
  sin_permiso: {
    titulo: "Esta sección no está disponible para tu perfil",
    mensaje: "Tu rol actual no incluye acceso a esta página.",
    queHacer: "Si crees que deberías tener acceso, cuéntanos y lo revisamos contigo.",
    reportable: true,
  },
  desconocido: {
    titulo: "Algo se rompió de nuestro lado",
    mensaje: "No fue culpa tuya y no perdiste nada de lo que ya habías guardado.",
    queHacer: "Puedes intentarlo de nuevo o contarnos qué estabas haciendo.",
    reportable: true,
  },
};

export function getErrorEntry(motivo: string | undefined | null): ErrorEntry {
  return ERROR_CATALOG[motivo ?? ""] ?? ERROR_CATALOG.desconocido;
}
