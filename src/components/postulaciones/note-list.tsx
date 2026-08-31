import type { ApplicationNote } from "@/lib/applications/get-applications";

export function NoteList({ notes }: { notes: ApplicationNote[] }) {
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">Sin notas todavía.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} className="border border-border bg-card p-3.5 text-sm">
          <p className="whitespace-pre-wrap">{note.body}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {note.authorName} · {new Date(note.createdAt).toLocaleString("es-GT")}
            {note.isPrivate && (
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                Privada
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
