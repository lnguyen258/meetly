import { PageHeader } from "@/components/page-header";
import CalendarView from "@/components/calendar-view";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Your personal schedule. Only free/busy time slots are ever shared with your team."
      />
      <CalendarView />
    </>
  );
}
