/** `<select>` con una opción por clave de un mapa de etiquetas (ej. WORK_MODE_LABEL) — evita repetir el Object.entries(...).map(...) en cada formulario que usa el mismo enum. */
export function LabelSelect({
  id,
  name,
  labels,
  defaultValue,
  required,
  className,
}: {
  id?: string;
  name: string;
  labels: Record<string, string>;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <select id={id} name={name} required={required} defaultValue={defaultValue ?? ""} className={className}>
      <option value="" disabled>
        Elige una opción
      </option>
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
