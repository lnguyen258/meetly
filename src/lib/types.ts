export type EventKind = "one_time" | "weekly";
export type EventStatus = "collecting" | "proposed" | "confirmed" | "cancelled";
export type Approval = "pending" | "accepted" | "declined";

export type MeetEvent = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  week_start: string; // YYYY-MM-DD
  duration_min: number;
  status: EventStatus;
  final_start: string | null;
  final_end: string | null;
  invite_code: string;
  created_at: string;
};

export type EventMember = {
  event_id: string;
  user_id: string;
  has_shared: boolean;
  auto_sync: boolean;
  approval: Approval;
  availability_updated_at: string;
  profiles: { display_name: string | null } | null;
};

export type CalendarItem = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  rrule: string | null;
  event_id: string | null;
};

export type AppNotification = {
  id: string;
  type: string;
  event_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

export type HeatRow = { slot_start: string; free_count: number; free_names: string[] | null };
