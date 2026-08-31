/**
 * Redacción obligatoria: qué pasó en humano → qué no se perdió → qué puede
 * hacer ahora. Nunca culpar al usuario, nunca jerga, nunca un código sin
 * explicación. Se amplía en la Fase 7 (Centro de errores) con reporte y
 * seguimiento; por ahora cubre los casos que ya existen (auth).
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
    queHacer: "Vuelve a intentarlo en unos segundos.",
    reportable: true,
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
