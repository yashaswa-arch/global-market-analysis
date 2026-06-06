"""AI chatbot — answers questions about global events via Groq."""

from groq_client import groq_complete

SYSTEM_DIRECT = """You are an AI assistant for the Global Event Intelligence Platform.

The context includes a CONSENSUS SUMMARY aggregating market_impacts across multiple events,
plus individual event details.

For market/asset questions:
- Synthesize ACROSS multiple events — do not rely on a single event alone
- Use the consensus summary for overall outlook (supporting vs conflicting events)
- Explain where events agree and where they diverge
- Write naturally in your own words

Never give buy/sell advice, target prices, or guaranteed predictions."""

SYSTEM_INFERENCE = """You are an AI assistant for the Global Event Intelligence Platform.

Direct market_impacts for the asked asset were not found. Use related events cautiously.
Clearly state answers are inferred. Synthesize across all provided events when possible.
Never give buy/sell advice, target prices, or guaranteed predictions."""

SYSTEM_GENERAL = """You are an AI assistant for the Global Event Intelligence Platform.

Synthesize across ALL provided events — avoid basing the answer on one event only.
When a consensus summary is present, use it for overall outlook and note agreement/conflict.
Write naturally. Never give buy/sell advice or guaranteed predictions."""


async def generate_reply(
    user_message: str,
    event_context: str = "",
    *,
    direct_evidence: bool = False,
    inference_mode: bool = False,
    detected_assets: list[str] | None = None,
    has_consensus: bool = False,
) -> str:
    if inference_mode:
        system = SYSTEM_INFERENCE
    elif direct_evidence and detected_assets:
        system = SYSTEM_DIRECT
    else:
        system = SYSTEM_GENERAL

    asset_line = ""
    if detected_assets:
        asset_line = f"\nDetected assets: {', '.join(detected_assets)}"

    evidence_line = (
        f"\nEvidence mode: {'direct' if direct_evidence else 'inference' if inference_mode else 'general'}"
    )
    consensus_line = (
        "\nConsensus summary provided: yes — use supporting vs conflicting events in your answer."
        if has_consensus
        else ""
    )

    user_prompt = f"""Analyzed event context:
{event_context}
{asset_line}{evidence_line}{consensus_line}

User question: {user_message}

Provide a clear answer synthesizing multiple events. For market questions, summarize
supporting events, any conflicting signals, and the overall outlook."""

    return await groq_complete(system, user_prompt)
