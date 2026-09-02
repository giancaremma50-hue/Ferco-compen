"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { contrastRatio } from "@/lib/color-contrast";
import { zodFieldError } from "@/lib/forms/zod-error";
import { optionalText } from "@/lib/zod-helpers";

// El fondo claro de la app (--background en globals.css). El foco de
// teclado se dibuja con este mismo acento (--ring: var(--accent)) — un
// color demasiado parecido al fondo lo vuelve invisible para cualquiera
// que navegue con teclado, violando la regla "foco visible siempre".
const APP_BACKGROUND = "#faf9f7";
const MIN_FOCUS_CONTRAST = 3; // mínimo WCAG para indicadores de UI/foco.

const BrandingSchema = z.object({
  platform_name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(60),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "El color debe ser un hexadecimal válido, ej. #1F4D3D." })
    .refine((hex) => contrastRatio(hex, APP_BACKGROUND) >= MIN_FOCUS_CONTRAST, {
      error: "Este color es muy parecido al fondo: el foco de teclado no se vería. Prueba uno más oscuro o más saturado.",
    }),
  careers_headline: optionalText(120),
  careers_intro: optionalText(500),
});

export type BrandingActionState = { error?: string; success?: string; field?: string } | undefined;

export async function updateBranding(
  _prevState: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const profile = await requireSuperAdmin();

  const parsed = BrandingSchema.safeParse({
    platform_name: formData.get("platform_name"),
    accent_color: formData.get("accent_color"),
    careers_headline: formData.get("careers_headline"),
    careers_intro: formData.get("careers_intro"),
  });

  if (!parsed.success) {
    return zodFieldError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      ...parsed.data,
      // undefined en un .update() de Supabase omite la columna en vez de
      // limpiarla — si el campo se dejó vacío a propósito, hay que mandar
      // null explícito para que sí se borre (mismo gotcha de Fase 9 con
      // normalizeDepartmentFields). `||` y no `??`: optionalText solo
      // convierte "" a undefined ANTES de recortar espacios — un valor de
      // puros espacios sobrevive el preprocess y llega aquí ya recortado
      // a "" (no undefined), que `??` no habría capturado.
      careers_headline: parsed.data.careers_headline || null,
      careers_intro: parsed.data.careers_intro || null,
    })
    .eq("id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo guardar. Inténtalo de nuevo en unos segundos." };
  }

  revalidatePath("/", "layout");
  return { success: "Marca actualizada" };
}

const BRAND_IMAGE_FIELDS = ["logo_url", "logo_dark_url", "login_image_url", "careers_cover_image_url"] as const;
export type BrandImageField = (typeof BRAND_IMAGE_FIELDS)[number];
const BrandImageFieldSchema = z.enum(BRAND_IMAGE_FIELDS);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// La extensión sale de esta tabla, nunca del nombre del archivo que manda
// el cliente — un nombre como "x.png/../../otro-campo" no debe poder
// alterar la ruta de storage.
// Sin SVG a propósito: el bucket es público y sirve el archivo tal cual,
// sin ningún CSP propio — un SVG con <script> se ejecutaría al abrir la
// URL directa. PNG/WebP no tienen ese riesgo.
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const ALLOWED_TYPES = new Set(Object.keys(EXTENSION_BY_MIME));

function brandImagePaths(organizationId: string, field: BrandImageField) {
  return Object.values(EXTENSION_BY_MIME).map((ext) => `${organizationId}/${field}.${ext}`);
}

export type UploadImageState = { error?: string; success?: boolean } | undefined;

export async function uploadBrandImage(
  _prevState: UploadImageState,
  formData: FormData,
): Promise<UploadImageState> {
  const profile = await requireSuperAdmin();
  const parsedField = BrandImageFieldSchema.safeParse(formData.get("field"));
  const file = formData.get("file");

  if (!parsedField.success) {
    return { error: "Campo de imagen inválido." };
  }
  const field = parsedField.data;
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo primero." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "El archivo pesa más de 5 MB. Prueba con una imagen más liviana." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Formato no admitido. Usa PNG, JPG o WebP." };
  }

  const supabase = await createClient();
  const extension = EXTENSION_BY_MIME[file.type];
  const path = `${profile.organization_id}/${field}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("marca-publico")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: "No se pudo subir el archivo. Inténtalo de nuevo." };
  }

  const { data: publicUrl } = supabase.storage.from("marca-publico").getPublicUrl(path);
  const cacheBusted = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const update: Partial<Record<BrandImageField, string>> = { [field]: cacheBusted };
  const { data: updateData, error: updateError } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", profile.organization_id)
    .select("id");

  if (updateError || !updateData || updateData.length === 0) {
    return { error: "El archivo se subió pero no se pudo guardar. Inténtalo de nuevo." };
  }

  // Limpieza best-effort: si el formato cambió (ej. .png -> .svg), el
  // archivo anterior queda huérfano en un path distinto porque `upsert`
  // solo sobrescribe una ruta idéntica. No afecta el resultado si falla.
  const stalePaths = brandImagePaths(profile.organization_id, field).filter((p) => p !== path);
  await supabase.storage.from("marca-publico").remove(stalePaths);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeBrandImage(fieldInput: BrandImageField) {
  const profile = await requireSuperAdmin();

  // Una Server Action es un endpoint invocable por red: el tipo de
  // BrandImageField no protege en runtime contra una llamada fabricada a
  // mano con otro nombre de columna (ej. allowed_email_domain).
  const parsedField = BrandImageFieldSchema.safeParse(fieldInput);
  if (!parsedField.success) {
    throw new Error("Campo de imagen inválido.");
  }
  const field = parsedField.data;

  const supabase = await createClient();

  // La base se actualiza primero: si esto falla, nunca se toca storage y
  // el campo sigue apuntando a un archivo que sigue existiendo. Al revés,
  // un storage.remove() fallido después de guardar solo deja un archivo
  // huérfano — inofensivo, nada lo referencia ya.
  const update: Partial<Record<BrandImageField, null>> = { [field]: null };
  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) throw new Error("No se pudo quitar la imagen.");

  // Limpieza best-effort: no sabemos con qué extensión se guardó, así que
  // se intentan todas las posibles.
  await supabase.storage.from("marca-publico").remove(brandImagePaths(profile.organization_id, field));

  revalidatePath("/", "layout");
}

// Un video de fondo puede pesar más de lo que una Server Action admite
// como body en Vercel — por eso este flujo NO sube el archivo a través de
// una acción: genera una URL firmada de Storage y el navegador sube el
// archivo directo desde el cliente (uploadToSignedUrl), sin pasar por el
// servidor de Next en absoluto.
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const ALLOWED_VIDEO_TYPES = new Set(Object.keys(VIDEO_EXTENSION_BY_MIME));

const BRAND_VIDEO_FIELDS = ["login_video_url", "careers_cover_video_url"] as const;
export type BrandVideoField = (typeof BRAND_VIDEO_FIELDS)[number];
const BrandVideoFieldSchema = z.enum(BRAND_VIDEO_FIELDS);

// El nombre de archivo en Storage es distinto del nombre de columna a
// propósito — "login_video" ya tiene videos subidos bajo ese path para
// organizaciones existentes; cambiarlo para que coincida con la columna
// (login_video_url) los dejaría huérfanos.
const VIDEO_PATH_STEM: Record<BrandVideoField, string> = {
  login_video_url: "login_video",
  careers_cover_video_url: "careers_cover_video",
};

function brandVideoPaths(organizationId: string, field: BrandVideoField) {
  return Object.values(VIDEO_EXTENSION_BY_MIME).map((ext) => `${organizationId}/${VIDEO_PATH_STEM[field]}.${ext}`);
}

export type CreateUploadUrlState =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

export async function createBrandVideoUploadUrl(
  fieldInput: BrandVideoField,
  mimeType: string,
  sizeBytes: number,
): Promise<CreateUploadUrlState> {
  const profile = await requireSuperAdmin();

  const parsedField = BrandVideoFieldSchema.safeParse(fieldInput);
  if (!parsedField.success) return { ok: false, error: "Campo de video inválido." };
  const field = parsedField.data;

  if (!ALLOWED_VIDEO_TYPES.has(mimeType)) {
    return { ok: false, error: "Formato no admitido. Usa MP4 o WebM." };
  }
  if (sizeBytes > MAX_VIDEO_BYTES || sizeBytes <= 0) {
    return { ok: false, error: "El video pesa más de 20 MB. Usa uno más corto o comprímelo." };
  }

  const extension = VIDEO_EXTENSION_BY_MIME[mimeType];
  const path = `${profile.organization_id}/${VIDEO_PATH_STEM[field]}.${extension}`;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("marca-publico").createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida. Inténtalo de nuevo." };

  return { ok: true, path: data.path, token: data.token };
}

export type ConfirmVideoState = { error?: string; success?: boolean } | undefined;

export async function confirmBrandVideoUpload(fieldInput: BrandVideoField, path: string): Promise<ConfirmVideoState> {
  const profile = await requireSuperAdmin();

  const parsedField = BrandVideoFieldSchema.safeParse(fieldInput);
  if (!parsedField.success) return { error: "Campo de video inválido." };
  const field = parsedField.data;

  // El path lo generó createBrandVideoUploadUrl() para esta misma
  // organización y campo — si no coincide con ese patrón, no hay nada que
  // confirmar (una llamada fabricada a mano no debería poder apuntar la URL
  // pública a una ruta arbitraria de otra organización).
  if (!brandVideoPaths(profile.organization_id, field).includes(path)) {
    return { error: "Ruta de video inválida." };
  }

  const supabase = await createClient();
  const { data: publicUrl } = supabase.storage.from("marca-publico").getPublicUrl(path);
  const cacheBusted = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const update: Partial<Record<BrandVideoField, string>> = { [field]: cacheBusted };
  const { error } = await supabase.from("organizations").update(update).eq("id", profile.organization_id);
  if (error) return { error: "El video se subió pero no se pudo guardar. Inténtalo de nuevo." };

  const stalePaths = brandVideoPaths(profile.organization_id, field).filter((p) => p !== path);
  await supabase.storage.from("marca-publico").remove(stalePaths);

  revalidatePath("/", "layout");
  revalidatePath("/login");
  revalidatePath("/empleos");
  return { success: true };
}

export async function removeBrandVideo(fieldInput: BrandVideoField): Promise<void> {
  const profile = await requireSuperAdmin();

  const parsedField = BrandVideoFieldSchema.safeParse(fieldInput);
  if (!parsedField.success) throw new Error("Campo de video inválido.");
  const field = parsedField.data;

  const supabase = await createClient();

  const update: Partial<Record<BrandVideoField, null>> = { [field]: null };
  const { error } = await supabase.from("organizations").update(update).eq("id", profile.organization_id);
  if (error) throw new Error("No se pudo quitar el video.");

  await supabase.storage.from("marca-publico").remove(brandVideoPaths(profile.organization_id, field));
  revalidatePath("/", "layout");
  revalidatePath("/login");
  revalidatePath("/empleos");
}
