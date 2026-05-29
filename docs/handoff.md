# Handoff — Portal de Compensaciones Ferco
## Estado al 29 de mayo de 2026

---

## Estado General

El portal está **funcional en producción** (Netlify). Los colaboradores pueden crear solicitudes, ver su tablero con tarjetas, y el historial de solicitudes finalizadas/canceladas. Los administradores ven el Kanban completo. Las notificaciones in-app están implementadas y parcialmente funcionando (ver pendientes).

**Último commit**: `e58644b` — feat: simplify form — remove bonuses, add reference amount/pct

---

## Lo que se Completó en Esta Sesión

### Formulario de solicitud (RequestForm.tsx)
- ✅ Eliminados los 5 campos `bonoVariable1-5` del schema, tipos y JSX
- ✅ Eliminado import de `getCurrencySymbol` (ya no se necesita en el form)
- ✅ Agregado campo condicional `montoReferencia` + `porcentajeReferencia` (aparece con animación solo para `incremento` y `ajuste_salarial`)
- ✅ Validación: al menos uno de los dos debe llenarse (superRefine)
- ✅ Justificación movida a Section 1 (debajo de detalleMovimiento)
- ✅ Placeholder de justificación mejorado
- ✅ "Nueva plaza" ya estaba en el listado — no requirió cambio

### Vista de detalle (RequestDetail.tsx)
- ✅ Eliminado bloque de bonos
- ✅ Reemplazado por bloque "Referencia de ajuste" con monto y/o porcentaje

### Tipos (types/index.ts)
- ✅ Eliminados `bonoVariable1-5` de la interfaz `Request`
- ✅ Agregados `montoReferencia?: number` y `porcentajeReferencia?: number`

### Dashboard colaborador (DashboardClient.tsx)
- ✅ Tab "Historial" para todos los no-admins (muestra `finalizada` + `cancelada_denegada`)
- ✅ "Mis solicitudes" muestra solo activas (`en_analisis` + `en_proceso_aprobacion`)
- ✅ Managers ven historial combinado (propias + equipo)
- ✅ Badges de conteo en cada tab

### FileUploadZone.tsx
- ✅ Botón "Adjuntar archivo" visible con ícono Paperclip
- ✅ `e.stopPropagation()` + `open()` para evitar doble diálogo

### Notificaciones
- ✅ NotificationPopover: estado `open` controlado — se cierra al hacer clic en notificación
- ✅ NotificationItem: read → `opacity-50 hover:opacity-80`; onClose prop para cerrar popover

---

## Issues Pendientes (Reportados por el Usuario — No Implementados Aún)

### 🔴 Issue 1: Admin no puede crear solicitudes
**Síntoma**: "Error al guardar la solicitud. Verifica tu conexión e inténtalo de nuevo."
**Causa probable**: Firestore SDK v9+ rechaza `undefined` como valor de campo. Cuando `porcentajeReferencia` no se llena (undefined), el spread `...data` en `addDoc` incluye `porcentajeReferencia: undefined`, que Firebase SDK puede rechazar.
**Fix**: Inicializar Firestore con `ignoreUndefinedProperties: true`:
```ts
// En src/lib/firebase/firestore.ts — reemplazar getFirestore(app) con:
import { initializeFirestore } from "firebase/firestore";
export const db = typeof window !== "undefined"
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : null as unknown as ReturnType<typeof getFirestore>;
```
**Alternativa**: Limpiar undefined de `data` antes del `addDoc` en `RequestForm.tsx`:
```ts
const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
requestRef = await addDoc(requestsCol(), { ...cleanData, ... });
```
**Archivo**: `src/lib/firebase/firestore.ts` (preferido) o `src/components/requests/RequestForm.tsx`

---

### 🟡 Issue 2: Quitar "Nueva Solicitud" del Sidebar
**Síntoma**: El sidebar tiene "Nueva Solicitud" como link, pero ya existe el botón "+ Nueva solicitud" en el header del dashboard.
**Fix**: En `src/components/layout/Sidebar.tsx`, eliminar el objeto `{ href: ROUTES.NUEVA_SOLICITUD, label: "Nueva Solicitud", icon: PlusCircle, ... }` del array `links`.
**Archivo**: `src/components/layout/Sidebar.tsx`

---

### 🔴 Issue 3: Dropdown del avatar muestra contenido en inglés
**Síntoma**: Al hacer clic en el avatar del perfil (esquina superior derecha), aparece contenido en inglés.
**Causa**: El `DropdownMenu` usa `@base-ui/react/menu` (base-ui, no Radix). La implementación actual en `Header.tsx` usa `DropdownMenuLabel` que mapea a `MenuPrimitive.GroupLabel` — base-ui puede renderizar texto o comportamiento en inglés por defecto en algunos contextos.
**Fix**: Reemplazar el DropdownMenu del Header con una implementación custom más simple usando el Popover de Radix (que SÍ funciona correctamente) o un menú nativo:
```tsx
// Opción: reemplazar el dropdown por un panel simple sin base-ui
// Mostrar: nombre + email + rol + "Cerrar sesión" button
// Usar el mismo Popover de @radix-ui/react-popover que ya se usa en NotificationPopover
```
**Archivo**: `src/components/layout/Header.tsx`
**Nota**: El `Popover` en `src/components/ui/popover.tsx` usa Radix y funciona bien. Crear un UserPopover similar al NotificationPopover.

---

### 🟡 Issue 4: Notificaciones no se marcan como leídas visualmente
**Síntoma**: El usuario hizo clic en notificaciones, fueron redirigidas, pero al abrir el popover nuevamente siguen con el punto dorado (no se ven translúcidas).
**Causa probable**: `markNotificationRead` puede estar fallando silenciosamente. No tiene try/catch en el caller (`handleRead`). Si el `updateDoc` falla (Firestore rules o network), el estado local no se actualiza.
**Posible causa secundaria**: El índice compuesto `notifications(recipientId ASC, createdAt DESC)` puede no estar creado, haciendo que el `onSnapshot` falle y no detecte cambios.
**Fix código**:
```ts
// En NotificationPopover.tsx — agregar try/catch en handleRead:
async function handleRead(id: string) {
  try {
    await markNotificationRead(id);
  } catch (err) {
    console.error("[Notifications] Failed to mark as read:", err);
  }
}
```
**Fix infraestructura**: Crear los índices compuestos faltantes en Firebase Console.
**Archivo**: `src/components/notifications/NotificationPopover.tsx`

---

### 🔵 Issue 5 (relacionado): Índices Compuestos Firestore
**Estado**: No creados — esto causa fallo silencioso en queries con `where + orderBy`.
**Acción manual requerida en Firebase Console → Firestore → Índices**:
1. Colección `notifications`: `recipientId (ASC)` + `createdAt (DESC)`
2. Colección `requests`: `createdBy (ASC)` + `createdAt (DESC)`

Sin estos índices:
- Las notificaciones de colaboradores pueden no cargarse
- Las solicitudes de colaboradores pueden no cargarse

---

## Orden Recomendado para Implementar Pendientes

1. **Fix Firestore** (Issue 1): `initializeFirestore` con `ignoreUndefinedProperties` en `firestore.ts`
2. **Fix Sidebar** (Issue 2): Remover link "Nueva Solicitud" en `Sidebar.tsx`
3. **Fix Header dropdown** (Issue 3): Reemplazar con UserPopover basado en Radix
4. **Fix notificaciones** (Issue 4): try/catch en handleRead
5. **Firebase Console**: Crear los 2 índices compuestos
6. Push + Netlify auto-deploy

---

## Contexto Técnico Importante para el Próximo Dev

### shadcn v4 — base-ui vs Radix (CRÍTICO)
Los componentes que usan **@base-ui/react** (NO soportan `asChild`):
- `Button`, `Select`, `DropdownMenu`, `Dialog`, `Checkbox`

Los componentes que usan **@radix-ui** (SÍ soportan `asChild`):
- `Popover` (`src/components/ui/popover.tsx`)

Si un componente muestra comportamiento extraño o en inglés, verificar si usa base-ui.

### React Hook Form + Zod con number inputs
Usar siempre `z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional())`. Nunca `z.coerce.number()` (rompe el tipo en el Resolver).

### Firebase — undefined en writes
El SDK v9+ puede rechazar `undefined` en documentos Firestore. Usar `initializeFirestore` con `ignoreUndefinedProperties: true` o limpiar el objeto antes de escribir.

### Select de shadcn v4 (base-ui)
`onValueChange` tipado como `(v: string | null) => void`. Usar `v ?? ""` o `if (v)` para manejar null.

---

## Firestore Rules Actuales (Temporal — Permisivo)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Reemplazar eventualmente con** (una vez creados los índices compuestos):
```
match /users/{uid} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null && request.auth.uid == uid;
}
match /requests/{requestId} {
  allow read, create, update: if request.auth != null;
}
match /requests/{requestId}/comments/{commentId} {
  allow read, create: if request.auth != null;
}
match /notifications/{notifId} {
  allow read, update: if request.auth != null && request.auth.uid == resource.data.recipientId;
  allow create: if request.auth != null;
}
```
