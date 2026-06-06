import apiClient from "./client";

export const eventsApi = {
  list: (params?: { limit?: number; offset?: number; source?: string }) =>
    apiClient.get("/events", { params }).then((r) => r.data),
  get: (eventId: string) => apiClient.get(`/events/${eventId}`).then((r) => r.data),
  triggerFetch: () => apiClient.post("/events/fetch").then((r) => r.data),
};

export const analysisApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    apiClient.get("/analysis", { params }).then((r) => r.data),
  get: (eventId: string) => apiClient.get(`/analysis/${eventId}`).then((r) => r.data),
  triggerRun: (batchSize?: number) =>
    apiClient.post("/analysis/run", null, { params: { batch_size: batchSize } }).then((r) => r.data),
};

export const authApi = {
  status: () => apiClient.get("/auth/status").then((r) => r.data),
  listSaved: () => apiClient.get("/auth/saved").then((r) => r.data),
  saveEvent: (eventId: string) =>
    apiClient.post("/auth/saved", { event_id: eventId }).then((r) => r.data),
  unsaveEvent: (eventId: string) => apiClient.delete(`/auth/saved/${eventId}`),
};

export const chatApi = {
  history: () => apiClient.get("/chat/history").then((r) => r.data),
  sendMessage: (message: string, eventIds?: string[]) =>
    apiClient.post("/chat/message", { message, event_ids: eventIds ?? [] }).then((r) => r.data),
};
