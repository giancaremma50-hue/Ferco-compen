import { requireProfile } from "@/lib/auth/dal";
import { getAllNotifications } from "@/lib/notifications/get-notifications";
import { NotificationItem } from "@/components/layout/notification-item";
import { MarkAllReadButton } from "@/components/layout/mark-all-read-button";

export default async function NotificacionesPage() {
  await requireProfile();
  const notifications = await getAllNotifications();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[32px]">Notificaciones</h1>
        {notifications.some((n) => !n.readAt) && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Sin notificaciones todavía.</p>
      ) : (
        <div className="mt-8 border border-border bg-card">
          {notifications.map((item) => (
            <NotificationItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
