# Napkin Runbook — Portal de Compensaciones Ferco
_Última actualización: 2026-05-29_

## Reglas de Curación
- Re-priorizar en cada lectura. Max 10 items por categoría.
- Solo notas recurrentes de alto valor. Incluir fecha + "Do instead".
- Leer ANTES de tocar código.

---

## Gotchas Críticos — shadcn v4 (MÁXIMA PRIORIDAD)

1. **[2026-05-22] DropdownMenu, Select, Button, Dialog usan @base-ui/react — NO asChild**
   Do instead: No pasar `asChild` a estos componentes. `DropdownMenuTrigger` renderiza un `<button>` nativo; pasar estilos directamente como className. `Select.onValueChange` es `(v: string | null) => void` — usar `v ?? ""`.

2. **[2026-05-22] Popover usa @radix-ui — SÍ soporta asChild**
   Do instead: `<PopoverTrigger asChild>{children}</PopoverTrigger>` funciona en `src/components/ui/popover.tsx`. No confundir con DropdownMenu.

3. **[2026-05-22] z.coerce.number().optional() devuelve unknown en RHF Resolver**
   Do instead: `z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional())` siempre para inputs numéricos de formularios HTML.

4. **[2026-05-29] Firestore SDK v9+ rechaza undefined en documentos**
   Do instead: Inicializar con `initializeFirestore(app, { ignoreUndefinedProperties: true })` en `src/lib/firebase/firestore.ts`. O limpiar el objeto: `Object.fromEntries(Object.entries(data).filter(([,v]) => v !== undefined))` antes de `addDoc`.

5. **[2026-05-22] Firebase en App Router — NUNCA importar en Server Components**
   Do instead: Todos los archivos Firebase tienen `"use client"`. Guard: `typeof window !== "undefined"` en los exports de `auth`, `db`, `storage`.

---

## Firebase — Config del Proyecto

1. **[2026-05-22] Proyecto Firebase: `ferco---compensaciones`**
   Do instead: Storage bucket = `ferco---compensaciones.firebasestorage.app`. Project ID = `ferco---compensaciones`. Variables en `.env.local` con prefijo `NEXT_PUBLIC_FIREBASE_*`.

2. **[2026-05-22] Firestore rules actuales: permisivas (temporal)**
   Do instead: La regla `match /{document=**} { allow read, write: if request.auth != null; }` es temporal. Ver `handoff.md` para las reglas específicas por colección que deben aplicarse tras crear los índices compuestos.

3. **[2026-05-22] Índices compuestos Firestore — NO creados aún**
   Do instead: Crear manualmente en Firebase Console → Firestore → Índices: (1) `notifications`: recipientId ASC + createdAt DESC. (2) `requests`: createdBy ASC + createdAt DESC. Sin estos, onSnapshot de colaboradores falla silenciosamente.

4. **[2026-05-22] Subir a Storage ANTES de crear doc Firestore**
   Do instead: `await uploadFile()` → obtener URL → luego `addDoc()`. Nunca al revés. Si falla Storage, crear doc sin adjuntos (non-fatal).

5. **[2026-05-22] CORS Storage: configurado via gsutil**
   Do instead: `gsutil cors set cors.json gs://ferco---compensaciones.firebasestorage.app` desde Google Cloud Shell en el proyecto correcto (`ferco---compensaciones`, no `dashboard-5s-e9781`).

---

## Arquitectura y Patrones

1. **[2026-05-22] No middleware de Next.js para Auth — usa AuthGuard client component**
   Do instead: `src/components/auth/AuthGuard.tsx` con `onAuthStateChanged`. El middleware de Next.js rompe Firebase Auth en Netlify.

2. **[2026-05-22] writeBatch() para operaciones atómicas**
   Do instead: Siempre usar batch para: cambio de etapa + notificación, comentario + increment(commentCount) + notificación. Nunca writes separados.

3. **[2026-05-22] Notificaciones v1 = solo in-app via Firestore onSnapshot**
   Do instead: Sin FCM, sin email, sin browser push. Fan-out manual a `notifications/{notifId}` para cada recipiente.

4. **[2026-05-29] DashboardClient — lógica de tabs por rol**
   Do instead: Admin → KanbanBoard. Non-admin → tabs: "Mis solicitudes" (ACTIVE_STAGES), "Mi equipo" (si hasTeam), "Historial" (HIST_STAGES). ACTIVE = [en_analisis, en_proceso_aprobacion]. HIST = [finalizada, cancelada_denegada].

5. **[2026-05-22] managerId denormalizado con managerName**
   Do instead: Escribir siempre ambos campos al crear usuario. `resolveManager()` en `src/constants/hierarchy.ts` calcula automáticamente desde la lista de usuarios en memoria.

---

## Tailwind v4 & Next.js

1. **[2026-05-22] Tailwind v4: config en globals.css con @theme inline — NO tailwind.config.ts**
   Do instead: Editar `src/app/globals.css`. Tokens CSS en `:root {}` y `.dark {}`. Nunca crear `tailwind.config.ts`.

2. **[2026-05-22] `next/image` es obligatorio para imágenes — no `<img>` nativo**
   Do instead: `import Image from "next/image"` con `width`, `height` y `alt` siempre. Logos: `className="object-contain"`.

---

## UX y Marca

1. **[2026-05-22] Gold accent = var(--gold) = #D4A017**
   Do instead: Usar `style={{ backgroundColor: "var(--gold)" }}` o `style={{ color: "var(--gold)" }}`. NUNCA hardcodear el hex ni usar clases Tailwind para gold.

2. **[2026-05-22] Todo el portal en español — zero texto en inglés en la UI**
   Do instead: Labels, placeholders, toasts, mensajes de error, estados vacíos — todo en español. "Cerrar sesión", "Sin solicitudes", "Marcar todo como leído", etc.

3. **[2026-05-29] Notificación no leída = punto gold + fondo primario. Leída = opacity-50**
   Do instead: En `NotificationItem`: unread → `bg-primary/5 hover:bg-primary/10` + `span` con `backgroundColor: var(--gold)`. Read → `opacity-50 hover:opacity-80 hover:bg-muted/50`.

---

## Deploy

1. **[2026-05-22] Netlify auto-deploy desde main — push = deploy**
   Do instead: `git push` a `main` dispara el build en Netlify automáticamente. URL: https://sweet-semifreddo-f03402.netlify.app. Variables de entorno se configuran en Netlify Dashboard, NO en el código.

2. **[2026-05-22] NEXT_PUBLIC_FIREBASE_API_KEY es pública — no tratar como secreto**
   Do instead: Las API keys de Firebase son seguras de exponer (las reglas de Firestore protegen los datos). Solo el Service Account JSON es realmente secreto — nunca commitear.
