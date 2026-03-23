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
    { id: "gemini-2-5-flash", name: "Gemini 2.5 Flash · 2025  (Google — Best free)" },
    { id: "gemini-2-flash",   name: "Gemini 2.0 Flash · 2025  (Google)" },
    { id: "gpt-4o-free",      name: "GPT-4o · 2024  (OpenAI)" },
    { id: "gpt-4o-mini",      name: "GPT-4o mini · 2024  (OpenAI)" },
    { id: "o4-mini",          name: "o4-mini · 2025  (OpenAI — Reasoning)" },
    { id: "gpt-5-mini",       name: "GPT-5 mini · 2025  (OpenAI)" },
    { id: "llama-3-3-70b",    name: "Llama 3.3 · 70B · 2024  (Meta, open-source)" },
    { id: "mixtral-8x7b",     name: "Mixtral 8×7B · 2024  (Mistral AI, open-source)" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku · 2024  (Anthropic)" },
    { id: "deepseek-v3",      name: "DeepSeek-V3 · 2024  (DeepSeek)" },
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
    name: "Greenfield (New Implementation)",
    subtitle: "Build clean. Scale fast. Innovate continuously.",
    description:
      "Greenfield implementation enables organizations to design SAP S/4HANA from scratch using standard best practices while adopting a Clean Core strategy, keeping the digital core free from heavy customizations. Extensions are built on SAP Business Technology Platform (BTP), enabling agility and future upgrades without disruption. This approach aligns with both RISE with SAP and GROW with SAP. Notably, GROW with SAP exclusively supports Greenfield on S/4HANA Cloud Public Edition, making it the natural home for cloud-first, standardized transformation.",
    tip: "GROW with SAP is the only migration path that supports SAP S/4HANA Cloud, Public Edition, meaning Greenfield is the only valid approach for organizations choosing the Public Cloud deployment model.",
  },
  brownfield: {
    id: "brownfield",
    name: "Brownfield (System Conversion)",
    subtitle: "Modernize fast without breaking what works.",
    description:
      "Brownfield focuses on converting an existing ECC system to S/4HANA while preserving historical data and processes, with a gradual shift toward Clean Core principles by identifying and decoupling custom code over time. Post-conversion, organizations typically leverage SAP Business Technology Platform (BTP) to offload enhancements and move toward side-by-side extensions. It is commonly adopted under RISE with SAP, especially when speed to go-live is critical but a full business process redesign is not feasible.",
    tip: "SAP's own Custom Code Migration toolset automatically scans existing ABAP code to classify what can be retained, must be adapted, or eliminated entirely, giving teams a clear remediation roadmap before conversion even begins.",
  },
  bluefield: {
    id: "bluefield",
    name: "Bluefield (Selective Data Transition)",
    subtitle: "Transform selectively. Innovate strategically.",
    description:
      "Bluefield enables selective migration of data and processes into S/4HANA, allowing organizations to redesign critical business areas while retaining valuable historical data, making it the most flexible migration path toward a Clean Core. By combining selective data transition tools with SAP Business Technology Platform (BTP) for extensions and integrations, enterprises can build a hybrid architecture that balances innovation and continuity. This approach fits well within RISE with SAP for complex enterprises requiring phased transformation across multiple business units or geographies.",
    tip: "Bluefield is the only approach that allows organizations to merge, split, or restructure company codes and legal entities during the migration itself, making it particularly powerful for post-merger integration scenarios.",
  },
};

export const PHASES_META: Record<string, { color: string; desc: string; label?: string }> = {
  discover:       { color: "bg-blue-400",   desc: "Value discovery, solution trials, biz case",  label: "Discover" },
  prepare:        { color: "bg-green-500",  desc: "Initiation, governance, provisioning, backlog", label: "Prepare" },
  explore:        { color: "bg-orange-400", desc: "FTS workshops, gap analysis, backlog",          label: "Explore" },
  realizeDevelop: { color: "bg-yellow-500", desc: "Config, custom dev, unit & string testing",     label: "Realize - Develop" },
  realizeUat:     { color: "bg-red-400",    desc: "UAT, defect resolution, end-user training",     label: "Realize - UAT" },
  deploy:         { color: "bg-teal-500",   desc: "Cutover and go-live",                  label: "Deploy" },
  run:            { color: "bg-purple-500", desc: "Hypercare and stabilisation",          label: "Run" },
};
