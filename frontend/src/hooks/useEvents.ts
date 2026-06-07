import { useQuery } from "@tanstack/react-query";
import { analysisApi, eventsApi } from "@/api";
import type { Analysis, EventWithAnalysis } from "@/types";

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
    queryFn: async (): Promise<EventWithAnalysis | undefined> => {
      const [eventsResponse, analysisResponse] = await Promise.all([
        eventsApi.list({ limit: 100 }),
        analysisApi.list({ limit: 100 }),
      ]);
      const event = eventsResponse.events.find((item) => String(item.id) === String(eventId));
      const analysis = analysisResponse.analysis.find(
        (item: Analysis) => String(item.event_id) === String(eventId),
      );
      const analyzedEvent = analysis?.events;
      const baseEvent = event ?? analyzedEvent;

      if (!baseEvent) return undefined;
      return { ...baseEvent, analysis };
    },
    enabled: Boolean(eventId),
  });
}

export function useAnalysis(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["analysis", params],
    queryFn: () => analysisApi.list(params),
    refetchInterval: 60_000,
  });
}

export function useUnanalyzedEvents(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["events", "unanalyzed", params],
    queryFn: () => eventsApi.listUnanalyzed(params),
    refetchInterval: 60_000,
  });
}
