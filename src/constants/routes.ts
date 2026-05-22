export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  NUEVA_SOLICITUD: "/solicitudes/nueva",
  SOLICITUD_DETALLE: (id: string) => `/solicitudes/${id}`,
  ADMIN_USUARIOS: "/admin/usuarios",
} as const;
