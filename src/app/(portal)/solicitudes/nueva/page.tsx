import { RequestForm } from "@/components/requests/RequestForm";

export default function NuevaSolicitudPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Nueva solicitud</h1>
        <p className="text-sm text-muted-foreground">
          Completa el formulario para crear una solicitud de análisis de compensación
        </p>
      </div>
      <RequestForm />
    </div>
  );
}
