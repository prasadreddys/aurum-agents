import { useState } from "react";
import { PROMPTS, TRACK_LABEL, type AgentPrompt } from "../data/prompts";
import { CONTRACT_DEPLOYED } from "../config/contract";
import LiveChecks from "./LiveChecks";

function PromptCard({ prompt }: { prompt: AgentPrompt }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
    } catch {
      // Clipboard API unavailable (non-secure context) — select fallback.
      const ta = document.createElement("textarea");
      ta.value = prompt.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="glass flex flex-col rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-lg font-bold text-aurum-gold">
          {String(prompt.id).padStart(2, "0")}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-right font-mono text-[10px] uppercase tracking-widest text-muted-grey">
          {TRACK_LABEL[prompt.track]}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold text-bone">{prompt.title}</h3>
      {prompt.requiresContract && !CONTRACT_DEPLOYED && (
        <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-amber-200">
          ◆ Requires deployed contract
        </p>
      )}
      <blockquote className="mt-3 flex-1 rounded-xl border border-white/5 bg-black/30 p-3 text-sm leading-relaxed text-bone/90">
        “{prompt.text}”
      </blockquote>
      {prompt.note && (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100/90">
          {prompt.note}
        </p>
      )}
      <button
        type="button"
        onClick={copy}
        className="btn-ghost mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold"
      >
        {copied ? "✓ Copied to clipboard" : "Copy prompt"}
      </button>
    </article>
  );
}

export default function PromptCenter() {
  return (
    <section id="prompts" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Agent wallet <span className="text-gold-gradient">prompt center</span>
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-grey">
          Copy-paste prompts for <strong className="text-bone">your own AI
          agent</strong> (Claude Code, OpenClaw, ChatGPT, Copilot) with the
          Binance Agentic Wallet skill installed. These are not website
          buttons — Binance Agentic Wallet has no browser provider and no
          website connect flow, and its skill has no native mint command.
          The connectable wallet for this website is{" "}
          <strong className="text-bone">Binance Web3 Wallet</strong> (WalletConnect
          v2 + injected provider), arriving with wallet wiring in Stage 4.
        </p>
        <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-100/90">
          <strong>Before any mint prompt:</strong> Binance warns that
          Developer mode lets an agent execute custom contract calls and can
          lead to asset loss. Enable it only in the Binance App, set
          high-risk transaction handling to “Require App confirmation” first,
          and disable Developer mode when done. Never sign in to your
          Agentic Wallet via a third-party website QR code — sign in only
          through the Binance App or a trusted agent.
        </div>
      </div>

      <LiveChecks />

      <div className="grid gap-4 md:grid-cols-2">
        {PROMPTS.map((p) => (
          <PromptCard key={p.id} prompt={p} />
        ))}
      </div>
    </section>
  );
}
