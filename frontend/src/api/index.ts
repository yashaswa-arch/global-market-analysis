import apiClient from "./client";
import type { AnalysisListResponse, ChatAskResponse, EventsListResponse } from "@/types";

const MAX_ANALYSIS_LIMIT = 500;

function normalizeAnalysisParams(params?: { limit?: number; offset?: number }) {
  if (!params) return params;
  return {
    ...params,
    limit: params.limit ? Math.min(params.limit, MAX_ANALYSIS_LIMIT) : params.limit,
  };
}

export const eventsApi = {
  list: (params?: { limit?: number; offset?: number; source?: string; search?: string; priority?: string; risk_level?: string }) => {
    const q = params?.search;
    const req = { ...params, q };
    delete req.search;
    return apiClient.get<EventsListResponse>("/api/events", { params: req }).then((r) => r.data);
  },
  listUnanalyzed: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<EventsListResponse>("/api/events/unanalyzed", { params }).then((r) => r.data),
  triggerFetch: () => apiClient.post("/api/events/fetch").then((r) => r.data),
};

export const analysisApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<AnalysisListResponse>("/api/analysis/", { params: normalizeAnalysisParams(params) }).then((r) => r.data),
  triggerRun: (batchSize?: number) =>
    apiClient.post("/api/analysis/run", null, { params: { batch_size: batchSize } }).then((r) => r.data),
  generateForEvent: (eventId: string) =>
    apiClient.post<{ status: string; analysis?: unknown; error?: string }>(`/api/analysis/${eventId}/generate`).then((r) => r.data),
};

export const authApi = {
  status: () => apiClient.get("/api/auth/status").then((r) => r.data),
  listSaved: () => apiClient.get("/api/auth/saved").then((r) => r.data),
  saveEvent: (eventId: string) =>
    apiClient.post("/api/auth/saved", { event_id: eventId }).then((r) => r.data),
  unsaveEvent: (eventId: string) => apiClient.delete(`/api/auth/saved/${eventId}`),
};

export const chatApi = {
  ask: (question: string) =>
    apiClient.post<ChatAskResponse>("/api/chat/ask", { question }).then((r) => r.data),
};

export const analyticsApi = {
  sources: () => apiClient.get("/api/analytics/sources").then((r) => r.data),
};

export const briefingsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get("/api/briefings/", { params }).then((r) => r.data),
};

export const marketApi = {
  live: () => apiClient.get("/api/market").then((r) => r.data),
};
