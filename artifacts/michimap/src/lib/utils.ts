import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export const MODELS = {
  free: [
    { id: "gpt-5-mini",       name: "GPT-5 mini · 2025  (Best free — OpenAI)" },
    { id: "gemini-2-5-flash", name: "Gemini 2.5 Flash · 2025  (Best free — Google)" },
    { id: "gemini-2-flash",   name: "Gemini 2.0 Flash · 2025  (Gemini free tier)" },
    { id: "gpt-4o-free",      name: "GPT-4o · 2024  (ChatGPT free tier)" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku · 2024  (Claude free tier)" },
    { id: "deepseek-v3",      name: "DeepSeek-V3 · 2024  (DeepSeek free tier)" },
    { id: "llama-3-3-70b",    name: "Llama 3.3 70B · 2024  (Meta, open source)" },
  ],
  paid: [
    { id: "gpt-4o",            name: "GPT-4o · 2024  (OpenAI API key)" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet · 2024  (Anthropic API key)" },
    { id: "gemini-1-5-pro",    name: "Gemini 1.5 Pro · 2024  (Google API key)" },
    { id: "deepseek-r1",       name: "DeepSeek-R1 · 2025  (DeepSeek API key)" },
  ],
};

export const TRANSITION_PATHS = {
  greenfield: {
    id: "greenfield",
    name: "Greenfield",
    subtitle: "Net-new, Best Practices, Clean slate",
    description:
      "Begin a net-new S/4HANA implementation using SAP Best Practices. Ideal for organisations seeking to transform business processes and adopt standard SAP without legacy constraints.",
  },
  brownfield: {
    id: "brownfield",
    name: "Brownfield",
    subtitle: "System conversion, Keep existing data, Faster go-live",
    description:
      "Convert your existing SAP landscape to S/4HANA while retaining historical data and configurations. Minimal business disruption, faster timeline, lower risk.",
  },
  bluefield: {
    id: "bluefield",
    name: "Bluefield",
    subtitle: "Selective migration, Hybrid approach, Data continuity",
    description:
      "Selectively migrate data and processes from your existing SAP system. Combines the clean-slate simplicity of Greenfield with the data continuity of Brownfield.",
  },
};

export const PHASES_META: Record<string, { color: string; desc: string; label?: string }> = {
  discover:       { color: "bg-blue-400",   desc: "Scoping, demos, business case",       label: "Discover" },
  prepare:        { color: "bg-green-500",  desc: "Kickoff, setup, standards",            label: "Prepare" },
  explore:        { color: "bg-orange-400", desc: "Fit-to-standard workshops",            label: "Explore" },
  realizeDevelop: { color: "bg-yellow-500", desc: "Config, development, testing",         label: "Realize - Develop" },
  realizeUat:     { color: "bg-red-400",    desc: "UAT, rehearsals, training",            label: "Realize - UAT" },
  deploy:         { color: "bg-teal-500",   desc: "Cutover and go-live",                  label: "Deploy" },
  run:            { color: "bg-purple-500", desc: "Hypercare and stabilisation",          label: "Run" },
};
