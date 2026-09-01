import { z } from "zod";
import { JobBaseSchema } from "@/lib/jobs/schema";

export const JobTemplateSchema = JobBaseSchema.pick({
  title: true,
  country: true,
  location: true,
  work_mode: true,
  employment_type: true,
  description: true,
  requirements: true,
}).extend({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
});
