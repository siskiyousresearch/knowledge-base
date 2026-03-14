export interface DocumentCategory {
  name: string;
  description: string;
}

export interface AutoScrapeConfig {
  url: string;
  maxDepth: number;
  maxPages: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  systemPrompt: string;
  documentCategories: DocumentCategory[];
  autoScrape: AutoScrapeConfig[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "general",
    name: "General",
    description: "Free-form knowledge base for any topic. Upload documents and chat with them.",
    icon: "FolderOpen",
    systemPrompt: "",
    documentCategories: [],
    autoScrape: [],
  },
  {
    id: "policy",
    name: "Policy & Procedures",
    description:
      "Specialized for California Community College administrative procedures, board policies, Ed Code, and union contracts.",
    icon: "Scale",
    systemPrompt: `You are a policy analyst assistant specializing in California Community College administrative procedures (APs), board policies (BPs), and related Education Code. When answering questions, cite specific policy numbers (e.g., AP 1234, BP 5678) and relevant Ed Code sections. Compare local policies against state requirements when applicable. Identify gaps or conflicts between local and state policies when relevant.`,
    documentCategories: [
      { name: "Administrative Procedures (APs)", description: "Local administrative procedures" },
      { name: "Board Policies (BPs)", description: "Local board policies" },
      { name: "California Education Code (Title 5)", description: "State education code and Title 5 regulations" },
      { name: "Faculty Union Contract/Handbook", description: "Faculty collective bargaining agreement" },
      { name: "Classified Staff (CSEA) Contract", description: "Classified employees bargaining agreement" },
      { name: "Staff Handbook", description: "General staff policies and procedures" },
    ],
    autoScrape: [
      {
        url: "https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/General-Counsel/Legal-Opinions",
        maxDepth: 2,
        maxPages: 100,
      },
      {
        url: "https://www.cccco.edu/About-Us/Chancellors-Office/Divisions/General-Counsel/Legal-Advisories",
        maxDepth: 2,
        maxPages: 100,
      },
      {
        url: "https://govt.westlaw.com/calregs/Browse/Home/California/CaliforniaCodeofRegulations?guid=I666C0070D48411DEBC02831C6D6C108E",
        maxDepth: 1,
        maxPages: 50,
      },
    ],
  },
  {
    id: "accjc",
    name: "ACCJC Accreditation",
    description:
      "Focused on ACCJC accreditation standards, eligibility requirements, and institutional self-evaluation.",
    icon: "Award",
    systemPrompt: `You are an accreditation specialist assistant for California Community Colleges. Answer questions using ACCJC (Accrediting Commission for Community and Junior Colleges) standards, eligibility requirements, and policies. Reference specific standard numbers (e.g., Standard I.A.1, Standard II.C.4) when citing accreditation criteria. Help identify evidence requirements, compliance gaps, and improvement recommendations aligned with ACCJC expectations.`,
    documentCategories: [
      { name: "ACCJC Standards & Eligibility Requirements", description: "Accreditation standards and eligibility criteria" },
      { name: "ACCJC Policies & Procedures", description: "Commission policies and procedures" },
      { name: "Institutional Self-Evaluation Report (ISER)", description: "Self-study report" },
      { name: "Quality Focus Essay (QFE)", description: "Quality focus projects" },
      { name: "Midterm Report", description: "Midterm progress reports" },
      { name: "Evidence Documentation", description: "Supporting evidence and documentation" },
    ],
    autoScrape: [
      {
        url: "https://accjc.org/eligibility-requirements-standards-policies/",
        maxDepth: 2,
        maxPages: 200,
      },
      {
        url: "https://accjc.org/policies/",
        maxDepth: 2,
        maxPages: 200,
      },
      {
        url: "https://accjc.org/resources/",
        maxDepth: 2,
        maxPages: 200,
      },
    ],
  },
];

export function getTemplate(id: string): ProjectTemplate {
  return PROJECT_TEMPLATES.find((t) => t.id === id) || PROJECT_TEMPLATES[0];
}
