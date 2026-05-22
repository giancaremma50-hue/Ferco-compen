"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addDoc,
  serverTimestamp,
  requestsCol,
  getAdminUids,
  createNotifications,
  writeBatch,
  db,
  generateRequestNumber,
} from "@/lib/firebase/firestore";
import { uploadFile } from "@/lib/firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "./FileUploadZone";
import { ROUTES } from "@/constants/routes";
import { Pais, TipoMovimiento } from "@/types";

const schema = z
  .object({
    tipoMovimiento: z.enum([
      "incremento",
      "promocion",
      "ajuste_salarial",
      "nueva_plaza",
      "otro",
    ] as const),
    tipoMovimientoOtro: z.string().optional(),
    detalleMovimiento: z.string().min(10, "Mínimo 10 caracteres"),
    nombreSolicitante: z.string().min(2, "Requerido"),
    puestoSolicitante: z.string().min(2, "Requerido"),
    nombrePersonaEvaluar: z.string().min(2, "Requerido"),
    puestoPersonaEvaluar: z.string().min(2, "Requerido"),
    pais: z.enum(["Guatemala", "El Salvador", "Honduras", "México"] as const),
    area: z.string().min(2, "Requerido"),
    sucursal: z.string().optional(),
    bonoVariable1: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional()),
    bonoVariable2: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional()),
    bonoVariable3: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional()),
    bonoVariable4: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional()),
    bonoVariable5: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional()),
    justificacion: z.string().min(20, "Mínimo 20 caracteres"),
  })
  .superRefine((data, ctx) => {
    if (
      data.tipoMovimiento === "otro" &&
      !data.tipoMovimientoOtro?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Especifica el tipo de movimiento",
        path: ["tipoMovimientoOtro"],
      });
    }
  });

// Explicit type to avoid `unknown` leaking from z.preprocess in Zod
type FormData = {
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
};

const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: "incremento", label: "Incremento salarial" },
  { value: "promocion", label: "Promoción" },
  { value: "ajuste_salarial", label: "Ajuste salarial" },
  { value: "nueva_plaza", label: "Nueva plaza" },
  { value: "otro", label: "Otro" },
];

const PAISES: { value: Pais; label: string }[] = [
  { value: "Guatemala", label: "Guatemala" },
  { value: "El Salvador", label: "El Salvador" },
  { value: "Honduras", label: "Honduras" },
  { value: "México", label: "México" },
];

export function RequestForm() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  const tipoMovimiento = watch("tipoMovimiento");

  async function onSubmit(data: FormData) {
    if (!userProfile) return;
    setIsSubmitting(true);

    try {
      const requestNumber = generateRequestNumber();

      // Upload files first
      const attachments = await Promise.all(
        files.map(async (file) => {
          const tempId = nanoid();
          const { storageUrl } = await uploadFile(
            file,
            tempId,
            userProfile.uid
          );
          return {
            id: nanoid(),
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            storageUrl,
            uploadedBy: userProfile.uid,
            uploadedAt: Timestamp.now(),
          };
        })
      );

      // Create the request doc
      const requestRef = await addDoc(requestsCol(), {
        requestNumber,
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName,
        ...data,
        attachments,
        stage: "en_analisis",
        commentCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Notify all admins
      const adminUids = await getAdminUids();
      const recipients = adminUids.filter((uid) => uid !== userProfile.uid);
      if (recipients.length > 0) {
        const batch = writeBatch(db);
        await createNotifications(batch, recipients, {
          type: "new_request",
          requestId: requestRef.id,
          requestNumber,
          requestTitle: data.detalleMovimiento,
          fromUserId: userProfile.uid,
          fromUserName: userProfile.displayName,
        });
        await batch.commit();
      }

      toast.success("Solicitud creada exitosamente");
      router.push(ROUTES.SOLICITUD_DETALLE(requestRef.id));
    } catch (err) {
      console.error(err);
      toast.error("Error al crear la solicitud. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Tipo de movimiento */}
        <Section title="Tipo de movimiento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de movimiento *" error={errors.tipoMovimiento?.message}>
              <Select
                onValueChange={(v) =>
                  setValue("tipoMovimiento", v as TipoMovimiento, { shouldValidate: true })
                }
              >
                <SelectTrigger className={errors.tipoMovimiento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {tipoMovimiento === "otro" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Field
                  label="Especifica el tipo *"
                  error={errors.tipoMovimientoOtro?.message}
                >
                  <Input
                    placeholder="Describe el tipo de movimiento"
                    {...register("tipoMovimientoOtro")}
                    className={errors.tipoMovimientoOtro ? "border-destructive" : ""}
                  />
                </Field>
              </motion.div>
            )}
          </div>

          <Field label="Detalle del movimiento *" error={errors.detalleMovimiento?.message}>
            <Textarea
              placeholder="Describe el movimiento en detalle..."
              rows={3}
              {...register("detalleMovimiento")}
              className={errors.detalleMovimiento ? "border-destructive" : ""}
            />
          </Field>
        </Section>

        {/* Section 2: Solicitante */}
        <Section title="Solicitante">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del solicitante *" error={errors.nombreSolicitante?.message}>
              <Input
                {...register("nombreSolicitante")}
                className={errors.nombreSolicitante ? "border-destructive" : ""}
              />
            </Field>
            <Field label="Puesto del solicitante *" error={errors.puestoSolicitante?.message}>
              <Input
                {...register("puestoSolicitante")}
                className={errors.puestoSolicitante ? "border-destructive" : ""}
              />
            </Field>
          </div>
        </Section>

        {/* Section 3: Persona a evaluar */}
        <Section title="Persona a evaluar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" error={errors.nombrePersonaEvaluar?.message}>
              <Input
                {...register("nombrePersonaEvaluar")}
                className={errors.nombrePersonaEvaluar ? "border-destructive" : ""}
              />
            </Field>
            <Field label="Puesto *" error={errors.puestoPersonaEvaluar?.message}>
              <Input
                {...register("puestoPersonaEvaluar")}
                className={errors.puestoPersonaEvaluar ? "border-destructive" : ""}
              />
            </Field>
            <Field label="País *" error={errors.pais?.message}>
              <Select
                onValueChange={(v) =>
                  setValue("pais", v as Pais, { shouldValidate: true })
                }
              >
                <SelectTrigger className={errors.pais ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar país..." />
                </SelectTrigger>
                <SelectContent>
                  {PAISES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Área *" error={errors.area?.message}>
              <Input
                {...register("area")}
                className={errors.area ? "border-destructive" : ""}
              />
            </Field>
            <Field label="Sucursal" error={errors.sucursal?.message}>
              <Input {...register("sucursal")} />
            </Field>
          </div>
        </Section>

        {/* Section 4: Bonos variables */}
        <Section title="Bonos variables (opcional)">
          <div className="grid gap-4 sm:grid-cols-5">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <Field key={n} label={`Bono ${n}`}>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  {...register(`bonoVariable${n}` as `bonoVariable${typeof n}`)}
                />
              </Field>
            ))}
          </div>
        </Section>

        {/* Section 5: Justificación */}
        <Section title="Justificación">
          <Field label="Justificación *" error={errors.justificacion?.message}>
            <Textarea
              placeholder="Explica la razón del movimiento..."
              rows={5}
              {...register("justificacion")}
              className={errors.justificacion ? "border-destructive" : ""}
            />
          </Field>
        </Section>

        {/* Section 6: Archivos */}
        <Section title="Archivos adjuntos">
          <FileUploadZone files={files} onFilesChange={setFiles} />
        </Section>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Crear solicitud"
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h3 className="text-sm font-semibold text-foreground border-b border-border pb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
