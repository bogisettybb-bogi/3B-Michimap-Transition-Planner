import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export const MODELS = {
  free: [
    { id: "gpt-5.2", name: "GPT-5.2 (OpenAI)" },
    { id: "claude-sonnet", name: "Claude Sonnet (Anthropic)" },
    { id: "gemini-flash", name: "Gemini Flash (Google)" },
    { id: "deepseek-v3", name: "Deepseek V3" },
  ],
  paid: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-opus", name: "Claude Opus" },
    { id: "gemini-ultra", name: "Gemini Ultra" },
    { id: "deepseek-r1", name: "Deepseek R1" },
    { id: "kimi-k1.5", name: "Kimi K1.5" },
  ]
};

export const TRANSITION_PATHS = {
  greenfield: {
    id: "greenfield",
    name: "Greenfield",
    subtitle: "Net-new · Best Practices · Clean slate",
    description: "Begin a net-new S/4HANA implementation using SAP Best Practices. Ideal for organisations seeking to transform business processes and adopt standard SAP without legacy constraints."
  },
  brownfield: {
    id: "brownfield",
    name: "Brownfield",
    subtitle: "System conversion · Keep existing data · Faster go-live",
    description: "Convert your existing SAP landscape to S/4HANA while retaining historical data and configurations. Minimal business disruption, faster timeline, lower risk."
  },
  bluefield: {
    id: "bluefield",
    name: "Bluefield",
    subtitle: "Selective migration · Hybrid approach · Data continuity",
    description: "Selectively migrate data and processes from your existing SAP system. Combines the clean-slate simplicity of Greenfield with the data continuity of Brownfield."
  }
};

export const PHASES_META = {
  discover: { color: "bg-blue-500", desc: "Scoping, demos, business case" },
  prepare: { color: "bg-emerald-500", desc: "Kickoff, setup, standards" },
  explore: { color: "bg-orange-500", desc: "Fit-to-standard workshops" },
  realizeDevelop: { color: "bg-yellow-500", desc: "Config, development, testing", label: "Realize-Develop" },
  deploy: { color: "bg-purple-500", desc: "Cutover, go-live prep" },
  run: { color: "bg-teal-500", desc: "Hypercare, stabilization" }
};
