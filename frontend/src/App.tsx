import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { Dashboard } from "@/pages/Dashboard";
import { EventDetails } from "@/pages/EventDetails";
import { CrisisFeed } from "@/pages/CrisisFeed";
import { MarketIntelligence } from "@/pages/MarketIntelligence";
import { Assistant } from "@/pages/Assistant";
import "./styles.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crisis-feed" element={<CrisisFeed />} />
            <Route path="/market-intelligence" element={<MarketIntelligence />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/events/:eventId" element={<EventDetails />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
