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
    { id: "gpt-5.2", name: "GPT-5.2 (OpenAI - Most Capable)" },
    { id: "claude-sonnet", name: "Claude Sonnet (Anthropic)" },
    { id: "gemini-flash", name: "Gemini Flash (Google)" },
    { id: "deepseek-v3", name: "Deepseek V3" },
  ],
  paid: [
    { id: "gpt-4o", name: "GPT-4o (Own Key)" },
    { id: "claude-opus", name: "Claude Opus (Own Key)" },
    { id: "gemini-ultra", name: "Gemini Ultra (Own Key)" },
    { id: "deepseek-r1", name: "Deepseek R1 (Own Key)" },
    { id: "kimi-k1.5", name: "Kimi K1.5 (Own Key)" },
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
