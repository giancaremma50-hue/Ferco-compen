/**
 * Política de privacidad: versión, vigencia y datos del responsable.
 *
 * Vive en código, no en la base de datos, a propósito: un documento legal
 * tiene que ser inmutable y auditable — git da fecha, autor y diff de cada
 * palabra que cambió. Una tabla editable desde la interfaz no da nada de eso,
 * y el dato que hay que poder demostrar años después es "a este texto exacto
 * aceptó esta persona este día".
 *
 * Al cambiar el texto de forma sustantiva se SUBE `POLITICA_VERSION`. Las
 * postulaciones viejas siguen apuntando a la versión que aceptaron
 * (`applications.privacy_consent_version`), que es justo el punto.
 */

/** Se guarda en cada postulación. Subir solo ante cambios sustantivos, no de redacción. */
export const POLITICA_VERSION = "0.1-borrador";

/** Fecha desde la que rige esta versión. */
export const POLITICA_VIGENCIA = "2026-09-08";

/**
 * Marcador de un dato que todavía no entregó el cliente.
 *
 * No es decorativo: `POLITICA_ES_BORRADOR` lo detecta y la página muestra un
 * aviso de "pendiente de revisión legal". Cuando se llenen los datos reales y
 * un abogado apruebe el texto, el aviso desaparece solo — nadie tiene que
 * acordarse de quitarlo, y no se puede publicar una política con huecos
 * haciéndola pasar por definitiva.
 */
const PENDIENTE = (que: string) => `[PENDIENTE: ${que}]`;

export const RESPONSABLE = {
  razonSocial: PENDIENTE("razón social del responsable"),
  nit: PENDIENTE("NIT"),
  domicilio: PENDIENTE("dirección fiscal"),
  /** Canal para ejercer derechos. Un candidato externo no tiene cuenta: el centro de errores no le sirve. */
  correoDerechos: PENDIENTE("correo de contacto para ejercer derechos"),
  /** Plazo de conservación de una candidatura no contratada. Decisión del cliente. */
  retencion: PENDIENTE("plazo de conservación"),
} as const;

/** True mientras quede cualquier dato sin entregar. Gobierna el aviso de borrador. */
export const POLITICA_ES_BORRADOR = Object.values(RESPONSABLE).some((v) => v.startsWith("[PENDIENTE:"));

/** Encargados que procesan datos por cuenta del responsable — hay que declararlos. */
export const ENCARGADOS = [
  {
    nombre: "Supabase",
    servicio: "Base de datos y almacenamiento de archivos (CV y adjuntos)",
    ubicacion: "Estados Unidos (us-west-2)",
  },
  {
    nombre: "Resend",
    servicio: "Envío de los correos de la plataforma",
    ubicacion: "Estados Unidos",
  },
  {
    nombre: "Vercel",
    servicio: "Alojamiento de la aplicación",
    ubicacion: "Estados Unidos",
  },
  {
    nombre: "Google",
    servicio: "Inicio de sesión de personal interno (no aplica a candidatos externos)",
    ubicacion: "Estados Unidos",
  },
] as const;
