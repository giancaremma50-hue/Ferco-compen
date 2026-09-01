"use client";

import { useState, useTransition } from "react";
import { toggleTask, deleteTask } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { DeleteButton } from "@/components/ui/delete-button";
import type { ApplicationTask } from "@/lib/applications/get-applications";

function TaskRow({ task, applicationId }: { task: ApplicationTask; applicationId: string }) {
  const [isDone, setIsDone] = useState(task.isDone);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const previous = isDone;
    setIsDone(!previous);
    startTransition(async () => {
      const result = await toggleTask(task.id, applicationId, !previous);
      if (result.error) {
        setIsDone(previous);
        notifyError(result.error);
      } else {
        notifySuccess(result.success ?? "Actualizado");
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 border border-border bg-card px-3.5 py-2.5 text-sm">
      <label className="flex min-w-0 items-center gap-2.5">
        <input
          type="checkbox"
          checked={isDone}
          disabled={pending}
          onChange={handleToggle}
          className="size-4 disabled:opacity-50"
        />
        <span className={isDone ? "truncate text-muted-foreground line-through" : "truncate"}>{task.description}</span>
      </label>
      <div className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
        {task.assignedToName && <span>{task.assignedToName}</span>}
        <DeleteButton
          itemLabel="esta tarea"
          iconOnly
          onDelete={() => deleteTask(task.id, applicationId)}
          successMessage="Tarea eliminada"
        />
      </div>
    </li>
  );
}

export function TaskList({ tasks, applicationId }: { tasks: ApplicationTask[]; applicationId: string }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin tareas todavía. Agrega la primera arriba.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} applicationId={applicationId} />
      ))}
    </ul>
  );
}
