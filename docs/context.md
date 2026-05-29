# Portal de Compensaciones — Ferco Cerámica
## Documento de Contexto del Proyecto

---

## ¿Qué es este proyecto?

Portal web interno para centralizar y gestionar solicitudes de análisis de compensación (incrementos salariales, promociones, ajustes, nuevas plazas). Reemplaza el proceso anterior disperso en correos y hojas de cálculo. Solo accesible para empleados de Ferco Cerámica.

---

## URLs y Repositorio

| Recurso | URL |
|---|---|
| **Producción** | https://sweet-semifreddo-f03402.netlify.app |
| **Repositorio GitHub** | https://github.com/giancaremma50-hue/Ferco-compen |
| **Firebase Console** | https://console.firebase.google.com → proyecto `ferco---compensaciones` |
| **Netlify Dashboard** | https://app.netlify.com → sitio `sweet-semifreddo-f03402` |

---

## Stack Técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router) | Deployed en Netlify via `@netlify/plugin-nextjs` |
| Lenguaje | **TypeScript** | Strict mode |
| Estilos | **Tailwind CSS v4** | Config en `globals.css` con `@theme inline`, NO `tailwind.config.ts` |
| Componentes UI | **shadcn/ui v4** | Mix de Radix UI y **@base-ui/react** — ver sección de gotchas |
| Animaciones | **framer-motion** | Usado en transiciones de página, campos condicionales, cards |
| Formularios | **react-hook-form** + **Zod** + `@hookform/resolvers` | |
| Backend/DB | **Firebase (Firestore, Auth, Storage)** | Solo cliente — sin Server Components |
| Drag & Drop | **@hello-pangea/dnd** | Solo admins pueden arrastrar |
| Notificaciones UI | **sonner** | Toasts de éxito/error |
| IDs únicos | **nanoid** | Para IDs de archivos adjuntos |
| Deploy | **Netlify** | Auto-deploy desde `main` en GitHub |

---

## Firebase — Detalles del Proyecto

- **Project ID**: `ferco---compensaciones`
- **Storage Bucket**: `ferco---compensaciones.firebasestorage.app`
- **Auth**: Email + Password únicamente
- **Regla Firestore actual** (temporal, permisiva):
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
  > ⚠️ Esta regla es temporal. Reemplazar con reglas específicas por colección una vez que los índices compuestos estén creados.

- **Storage CORS**: Configurado via `gsutil cors set cors.json gs://ferco---compensaciones.firebasestorage.app`
- **Variables de entorno** (Netlify + `.env.local`):
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## Modelo de Datos (Firestore)

### Colección `users/{uid}`
```ts
UserProfile {
  uid: string
  email: string
  displayName: string
  role: "administrador" | "colaborador"
  area: string              // de AREAS en hierarchy.ts
  cargo: string             // de CARGO_HIERARCHY según área+país
  pais: Pais | null         // "Guatemala" | "El Salvador" | "Honduras" | "México"
  managerId: string | null  // UID del jefe directo
  managerName: string | null // Nombre del jefe (desnormalizado)
  createdAt: Timestamp
  lastLoginAt: Timestamp
}
```

### Colección `requests/{requestId}`
```ts
Request {
  id: string
  requestNumber: string      // "COMP-2026-XXXXXX"
  createdBy: string          // UID del creador
  creatorName: string
  tipoMovimiento: TipoMovimiento
  tipoMovimientoOtro?: string  // Solo si tipoMovimiento === "otro"
  detalleMovimiento: string
  montoReferencia?: number    // Solo para incremento/ajuste_salarial
  porcentajeReferencia?: number // Solo para incremento/ajuste_salarial
  justificacion: string
  nombreSolicitante: string
  puestoSolicitante: string
  nombrePersonaEvaluar: string
  puestoPersonaEvaluar: string
  pais: Pais
  area: string
  sucursal?: string
  stage: Stage               // ver etapas abajo
  attachments: FileAttachment[]
  commentCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
  stageChangedAt?: Timestamp
  stageChangedBy?: string
}
```

### Subcolección `requests/{requestId}/comments/{commentId}`
```ts
Comment {
  id: string
  requestId: string
  content: string
  authorId: string
  authorName: string
  authorRole: Role
  parentId: string | null  // Para respuestas anidadas
  createdAt: Timestamp
}
```

### Colección `notifications/{notifId}`
```ts
Notification {
  id: string
  recipientId: string
  type: "new_request" | "stage_changed" | "new_comment" | "comment_replied"
  requestId: string
  requestNumber: string
  requestTitle: string
  fromUserId: string
  fromUserName: string
  newStage?: Stage          // Solo para stage_changed
  commentPreview?: string   // Solo para new_comment / comment_replied
  read: boolean
  createdAt: Timestamp
}
```

---

## Etapas de Solicitud (Stage)

| ID | Label | Color |
|---|---|---|
| `en_analisis` | En Análisis | Azul |
| `en_proceso_aprobacion` | En Proceso de Aprobación | Ámbar |
| `finalizada` | Finalizada | Esmeralda |
| `cancelada_denegada` | Cancelada / Denegada | Rojo |

---

## Tipos de Movimiento (TipoMovimiento)

| Valor | Label | Campo extra |
|---|---|---|
| `incremento` | Incremento salarial | Monto/Porcentaje de referencia (al menos uno requerido) |
| `promocion` | Promoción | — |
| `ajuste_salarial` | Ajuste salarial | Monto/Porcentaje de referencia (al menos uno requerido) |
| `nueva_plaza` | Nueva plaza | — |
| `otro` | Otro | `tipoMovimientoOtro` (texto libre, requerido) |

---

## Estructura de Roles y Jerarquía

### Roles en el sistema
- **administrador**: Ve todas las solicitudes en Kanban, puede drag-and-drop entre etapas, gestiona usuarios.
- **colaborador**: Ve sus propias solicitudes en grid de tarjetas, puede ver solicitudes de su equipo si es manager, tiene tab Historial.

### Jerarquía organizacional (hierarchy.ts)
**Comercial** (varía por país):
- Guatemala: Director Comercial → Director Retail → Regional
- El Salvador / Honduras: Director Comercial → Sucursal
- México: Director Comercial → Regional

**Áreas admin** (Finanzas, RH, Auditoría, Cajas, Ops, Exportaciones, IT):
- Director → Gerente (igual para todos los países)

### Visibilidad de solicitudes
- **Admin**: todas las solicitudes
- **Colaborador sin reportes directos**: solo las suyas
- **Manager (tiene reportes directos)**: las suyas + las de su equipo (solo nivel 1)
- **Tab "Historial"**: solicitudes `finalizada` + `cancelada_denegada`
- **Tab "Mis solicitudes"**: solicitudes `en_analisis` + `en_proceso_aprobacion`

---

## Reglas de Notificación

| Evento | Quién dispara | Quiénes reciben |
|---|---|---|
| Nueva solicitud creada | Cualquier usuario | Todos los admins (excepto el creador) |
| Cambio de etapa (Kanban) | Admin | Creador de la solicitud |
| Comentario de colaborador | Colaborador | Todos los admins |
| Comentario de admin | Admin | Creador de la solicitud |
| Respuesta a comentario | Cualquiera | Autor del comentario padre (si es distinto) |

---

## Estructura de Archivos Clave

```
src/
├── app/
│   ├── layout.tsx                     # Root layout + AuthProvider
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── setup/page.tsx             # Creación masiva de usuarios (primera vez)
│   └── (portal)/
│       ├── layout.tsx                 # AuthGuard + PortalShell
│       ├── dashboard/page.tsx         # → DashboardClient
│       ├── solicitudes/
│       │   ├── nueva/page.tsx         # → RequestForm
│       │   └── [id]/page.tsx          # → RequestDetail
│       └── admin/usuarios/page.tsx    # Gestión de usuarios (admin only)
├── components/
│   ├── auth/
│   │   ├── AuthGuard.tsx
│   │   └── LoginForm.tsx
│   ├── kanban/
│   │   ├── DashboardClient.tsx        # Lógica de tabs admin/colaborador/manager
│   │   ├── KanbanBoard.tsx            # Solo admins — drag & drop
│   │   ├── KanbanCard.tsx
│   │   └── KanbanColumn.tsx
│   ├── layout/
│   │   ├── Header.tsx                 # Logo + NotificationBell + avatar dropdown
│   │   ├── Sidebar.tsx                # Links de navegación + cerrar sesión
│   │   ├── Shell.tsx
│   │   └── PortalShell.tsx
│   ├── requests/
│   │   ├── RequestForm.tsx            # Formulario de nueva solicitud (Zod + RHF)
│   │   ├── RequestDetail.tsx          # Vista detalle + CommentThread
│   │   ├── RequestCard.tsx            # Tarjeta para vista colaborador
│   │   ├── RequestCardGrid.tsx        # Grid responsivo de tarjetas
│   │   ├── FileUploadZone.tsx         # react-dropzone con botón explícito
│   │   └── FileAttachmentList.tsx
│   ├── comments/
│   │   ├── CommentThread.tsx
│   │   ├── CommentInput.tsx           # Basado en prompt-input.tsx de shadcn
│   │   └── CommentBubble.tsx
│   ├── notifications/
│   │   ├── NotificationBell.tsx       # Ícono con badge de no leídas
│   │   ├── NotificationPopover.tsx    # Popover controlado (se cierra al hacer clic)
│   │   └── NotificationItem.tsx       # Link → solicitud; read = opacity-50
│   └── ui/                            # shadcn/ui components
├── constants/
│   ├── kanban.ts                      # STAGES, STAGE_MAP
│   ├── routes.ts                      # ROUTES object
│   ├── hierarchy.ts                   # AREAS, CARGO_HIERARCHY, helpers
│   └── currency.ts                    # getCurrencySymbol, formatCurrency por Pais
├── context/
│   └── AuthContext.tsx                # userProfile, role, loading
├── hooks/
│   ├── useRequests.ts                 # onSnapshot con lógica admin/collab/manager
│   ├── useNotifications.ts            # onSnapshot por recipientId
│   └── useComments.ts
├── lib/firebase/
│   ├── config.ts                      # initializeApp
│   ├── auth.ts                        # signIn, signOut helpers
│   ├── firestore.ts                   # db, collection refs, CRUD, fan-out
│   └── storage.ts                     # uploadFile, deleteFile
└── types/
    └── index.ts                       # UserProfile, Request, Comment, Notification
```

---

## Índices Compuestos Requeridos en Firestore

> ⚠️ Sin estos índices las queries con `orderBy` + `where` fallan silenciosamente.

| Colección | Campo 1 | Campo 2 | Estado |
|---|---|---|---|
| `notifications` | `recipientId` (ASC) | `createdAt` (DESC) | Pendiente de crear |
| `requests` | `createdBy` (ASC) | `createdAt` (DESC) | Pendiente de crear |

Para crearlos: Firebase Console → Firestore → Índices → Agregar índice compuesto.

---

## Paleta de Marca

| Token | Valor | Uso |
|---|---|---|
| Navy | `#171717` (--foreground) | Texto principal, fondo sidebar |
| Gold | `#D4A017` (--gold) | Acento: bordes activos, badges no leídos, dots de notif |
| Primary | `var(--primary)` | Botones, nav activa |
| Background | `var(--background)` | Fondo de página |

---

## Decisiones Arquitectónicas Importantes

1. **Firebase solo en cliente**: Todo Firebase tiene `"use client"` y guard `typeof window !== "undefined"`. Nunca importar en Server Components.
2. **No middleware de Next.js**: El AuthGuard es un client component. El middleware de Next.js rompe Firebase Auth en Netlify.
3. **Uploads antes que writes**: `uploadFile()` → obtener URL → luego `addDoc()`. Nunca al revés.
4. **`writeBatch()` para atomicidad**: Cambios de etapa + notificaciones en un batch. Comentarios + `increment(commentCount)` + notificaciones en un batch.
5. **managerId desnormalizado**: Se guarda `managerName` junto a `managerId` para evitar joins en lectura.
6. **shadcn v4 = base-ui para algunos componentes**: `DropdownMenu`, `Select`, `Button` usan `@base-ui/react`. NO tienen `asChild`. `Popover` usa `@radix-ui/react-popover` y SÍ tiene `asChild`.
