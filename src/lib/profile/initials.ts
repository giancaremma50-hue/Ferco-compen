/** Única fuente de verdad para las iniciales de respaldo del avatar. */
export function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
