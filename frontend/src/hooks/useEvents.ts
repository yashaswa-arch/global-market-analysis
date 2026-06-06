import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/api";

export function useEvents(params?: { limit?: number; source?: string }) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => eventsApi.list(params),
    refetchInterval: 60_000,
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.get(eventId),
    enabled: Boolean(eventId),
  });
}
