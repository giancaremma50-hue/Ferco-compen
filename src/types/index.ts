import { Timestamp } from "firebase/firestore";

export type Role = "administrador" | "colaborador";

export type TipoMovimiento =
  | "incremento"
  | "promocion"
  | "ajuste_salarial"
  | "nueva_plaza"
  | "otro";

export type Stage =
  | "en_analisis"
  | "en_proceso_aprobacion"
  | "finalizada"
  | "cancelada_denegada";

export type Pais = "Guatemala" | "El Salvador" | "Honduras" | "México";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  area: string;
  cargo: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface FileAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageUrl: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
}

export interface Request {
  id: string;
  requestNumber: string;
  createdBy: string;
  creatorName: string;
  tipoMovimiento: TipoMovimiento;
  tipoMovimientoOtro?: string;
  detalleMovimiento: string;
  nombreSolicitante: string;
  puestoSolicitante: string;
  nombrePersonaEvaluar: string;
  puestoPersonaEvaluar: string;
  pais: Pais;
  area: string;
  sucursal?: string;
  bonoVariable1?: number;
  bonoVariable2?: number;
  bonoVariable3?: number;
  bonoVariable4?: number;
  bonoVariable5?: number;
  justificacion: string;
  stage: Stage;
  attachments: FileAttachment[];
  commentCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stageChangedAt?: Timestamp;
  stageChangedBy?: string;
}

export interface Comment {
  id: string;
  requestId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  parentId: string | null;
  attachments?: FileAttachment[];
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

export type NotificationType =
  | "new_request"
  | "stage_changed"
  | "new_comment"
  | "comment_replied";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  requestId: string;
  requestNumber: string;
  requestTitle: string;
  fromUserId: string;
  fromUserName: string;
  newStage?: Stage;
  commentPreview?: string;
  read: boolean;
  createdAt: Timestamp;
}
