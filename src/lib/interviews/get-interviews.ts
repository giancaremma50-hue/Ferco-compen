import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ApplicationInterview = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  status: Database["public"]["Enums"]["interview_status"];
  attendeeNames: string[];
};

export async function getApplicationInterviews(applicationId: string): Promise<ApplicationInterview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interviews")
    .select(
      "id, scheduled_at, duration_minutes, location, notes, status, interview_attendees(profiles(display_name))",
    )
    .eq("application_id", applicationId)
    .order("scheduled_at", { ascending: false });

  return (data ?? []).map((i) => ({
    id: i.id,
    scheduledAt: i.scheduled_at,
    durationMinutes: i.duration_minutes,
    location: i.location,
    notes: i.notes,
    status: i.status,
    attendeeNames: i.interview_attendees.map((a) => a.profiles?.display_name).filter((n): n is string => Boolean(n)),
  }));
}
