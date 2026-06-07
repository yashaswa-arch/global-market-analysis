import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { chatApi } from "@/api";
import { Badge, toneForOutlook } from "@/components/Badge";
import { EmptyBlock, ErrorBlock } from "@/components/Status";
import { buildConsensusRows, suggestedPrompts } from "@/lib/intelligence";
import type { ChatAskResponse } from "@/types";
import { percent } from "@/utils/formatters";

export function Assistant() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ChatAskResponse | null>(null);
  const consensusRows = result ? buildConsensusRows(result.consensus) : [];

  const chatMutation = useMutation({
    mutationFn: (value: string) => chatApi.ask(value),
    onSuccess: setResult,
  });

  function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    chatMutation.mutate(trimmed);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return (
    <main className="intelligence-page assistant-page">
      <section className="page-banner">
        <div>
          <p className="eyebrow">AI assistant</p>
          <h1>Ask for synthesized crisis, market, and sector intelligence.</h1>
          <p>The assistant returns structured consensus cards and source-backed evidence.</p>
        </div>
      </section>

      <section className="assistant-layout panel intelligence-panel">
        <div className="prompt-row">
          {suggestedPrompts.map((prompt) => (
            <button key={prompt} className="prompt-chip" type="button" onClick={() => ask(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <form className="chat-form" onSubmit={onSubmit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a market or crisis intelligence question"
          />
          <button disabled={chatMutation.isPending} type="submit">
            {chatMutation.isPending ? "Analyzing..." : "Ask AI"}
          </button>
        </form>

        {chatMutation.isError ? <ErrorBlock message="The assistant could not answer right now." /> : null}

        {result ? (
          <div className="assistant-grid">
            <section className="assistant-answer panel-surface">
              <h2>AI Answer</h2>
              <p>{result.answer}</p>
            </section>

            <section className="assistant-consensus panel-surface">
              <h2>Consensus Cards</h2>
              {consensusRows.length ? (
                <div className="mini-card-grid">
                  {consensusRows.map((item) => (
                    <article className={`asset-card market-outlook-card asset-card--${outlookClass(item.overall_outlook)}`} key={item.asset}>
                      <div className="asset-card__header">
                        <div>
                          <span className="asset-kicker">Consensus</span>
                          <h3>{item.asset}</h3>
                        </div>
                        <Badge tone={toneForOutlook(item.overall_outlook)}>{item.overall_outlook}</Badge>
                      </div>
                      <div className="confidence-bar" aria-label={`Confidence ${Math.round(item.weighted_confidence)} percent`}>
                        <span style={{ width: `${Math.max(4, Math.min(100, item.weighted_confidence))}%` }} />
                      </div>
                      <div className="asset-stats">
                        <span>Confidence <strong>{percent(item.weighted_confidence)}</strong></span>
                        <span>Supporting <strong>{item.supporting_events.length}</strong></span>
                        <span>Conflicting <strong>{item.conflicting_events.length}</strong></span>
                      </div>
                      <p>{item.reasoning}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="No structured consensus returned for this question." />
              )}
            </section>

            <section className="assistant-sources panel-surface">
              <h2>Sources</h2>
              <div className="source-list">
                {result.sources.length ? (
                  result.sources.map((source) => (
                    <a key={source.event_id} href={source.url} target="_blank" rel="noreferrer">
                      <strong>{source.title ?? "Untitled source"}</strong>
                      <span>{source.category ?? "General"}</span>
                      {source.summary ? <p>{source.summary}</p> : null}
                    </a>
                  ))
                ) : (
                  <EmptyBlock message="No sources returned for this response." />
                )}
              </div>
            </section>
          </div>
        ) : (
          <EmptyBlock message="Ask a question to see AI answer, consensus results, and sources used." />
        )}
      </section>
    </main>
  );
}

function outlookClass(outlook: string) {
  const normalized = outlook.toLowerCase();
  if (normalized.includes("bull")) return "up";
  if (normalized.includes("bear")) return "down";
  if (normalized.includes("mixed")) return "mixed";
  return "neutral";
}
