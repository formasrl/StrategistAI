export interface StepGuidance {
  description: string;
  why_matters: string;
  guiding_questions: string[];
  expected_output: string;
}

export const stepGuidanceLibrary: Record<string, StepGuidance> = {
  // --- CUSTOM / PRE-PHASE KICKOFF ---
  "Project Kick-off & Objectives": {
    description:
      "Run a focused internal workshop to align stakeholders on why this brand project exists, what success looks like, and how decisions will be made.",
    why_matters:
      "Without a clear shared definition of success, the rest of the brand work will drift, get second‑guessed, or stall when trade‑offs appear.",
    guiding_questions: [
      "What business outcomes should this brand project directly support in the next 12–24 months?",
      "Which specific problems or opportunities triggered this project now (not last year, not next year)?",
      "Who are the 3–5 core decision‑makers and what authority do they each have?",
      "What constraints (budget, timing, markets, internal politics) must this project respect?",
      "How will we know this project was successful in 6–12 months?"
    ],
    expected_output:
      "A concise 1–2 page kick‑off summary capturing business goals, success metrics, decision‑makers, and project constraints.",
  },

  // --- PHASE 1: DISCOVERY & RESEARCH ---
  "Define Your Project Scope & Research Objectives": {
    description:
      "Clarify exactly what you need to research and why. Define the business context, establish specific research objectives, and set the timeline and budget.",
    why_matters:
      "Ensures alignment between the client and the branding team from the outset, setting clear objectives and scope to prevent wasted effort.",
    guiding_questions: [
      "What specific questions do you need answered by the end of this phase?",
      "What is the geographic scope of your project?",
      "Are you starting fresh, rebranding, or entering a new market?",
      "Who needs to be part of the core research team?"
    ],
    expected_output:
      "Research objectives document outlining scope, timeline, and team responsibilities.",
  },
  "Conduct Secondary Research (Desk Research)": {
    description:
      "Gather existing data about your market, industry, and competitors from published sources like industry reports, government datasets, and news articles.",
    why_matters:
      "Provides a baseline understanding of the market landscape and competitive environment before investing in primary research.",
    guiding_questions: [
      "What is the current market size and growth trajectory?",
      "What are the top 3-5 trends driving the market?",
      "Who are the direct and indirect competitors?",
      "What emerging technologies are affecting the industry?"
    ],
    expected_output:
      "Secondary Research Report (4-6 pages) summarizing market overview, trends, and preliminary insights.",
  },
  "Calculate Market Sizing (TAM, SAM, SOM)": {
    description:
      "Estimate the Total Addressable Market, Serviceable Available Market, and Serviceable Obtainable Market to understand the actual size of the opportunity.",
    why_matters:
      "Validates the business model and helps set realistic growth targets based on actual market potential.",
    guiding_questions: [
      "What is the total revenue opportunity if you reached 100% of the market (TAM)?",
      "What portion can you realistically serve based on your business model (SAM)?",
      "What is your realistic market share target for years 1-3 (SOM)?",
      "Which calculation method (Top-Down vs Bottom-Up) yields more reliable data?"
    ],
    expected_output:
      "Market Sizing Analysis with TAM/SAM/SOM figures and methodology explained.",
  },
  "Conduct Primary Research - Qualitative": {
    description:
      "Speak directly with potential customers and stakeholders through 1-on-1 interviews or focus groups to understand deep motivations and pain points.",
    why_matters:
      "Uncovers the 'why' behind customer behaviors that quantitative data often misses.",
    guiding_questions: [
      "What frustrates customers most about current solutions?",
      "How do they currently solve this problem?",
      "What would an ideal solution look like to them?",
      "Who is involved in their decision-making process?"
    ],
    expected_output:
      "Qualitative Research Summary including interview themes, quotes, and preliminary personas.",
  },
  "Conduct Primary Research - Quantitative": {
    description:
      "Gather numerical data through customer surveys (min 100 responses) to validate qualitative findings, rank pain points, and identify trends.",
    why_matters:
      "Provides statistical backing for strategic decisions and validates hypotheses from interviews.",
    guiding_questions: [
      "How frequently do customers face the specific problem?",
      "How do they rank the importance of different features/capabilities?",
      "What is their willingness to pay?",
      "Which demographic segments show the strongest interest?"
    ],
    expected_output:
      "Quantitative Research Summary with survey results, charts, and data validation.",
  },
  "Conduct Existing Brand Audit": {
    description:
      "Assess how the current brand performs and is perceived regarding visual identity, messaging, and market positioning. (Skip if new startup).",
    why_matters:
      "Identifies the gap between current reality and desired perception, highlighting exactly what needs to change.",
    guiding_questions: [
      "Is the visual identity consistent across all touchpoints?",
      "Does current messaging align with the customer needs identified?",
      "How does the brand sentiment compare to competitors?",
      "What are the biggest gaps between current and desired positioning?"
    ],
    expected_output:
      "Brand Audit Report highlighting visual/messaging strengths, weaknesses, and gaps.",
  },
  "Conduct SWOT Analysis": {
    description:
      "Synthesize all research into a strategic overview (Strengths, Weaknesses, Opportunities, Threats) to identify competitive advantages.",
    why_matters:
      "Transforms raw data into actionable strategic insights, highlighting where to play and how to win.",
    guiding_questions: [
      "What unique internal capabilities do we have (Strengths)?",
      "What resources do we lack (Weaknesses)?",
      "What market trends can we capitalize on (Opportunities)?",
      "What external factors could disrupt us (Threats)?"
    ],
    expected_output: "SWOT Matrix & Analysis document with strategic implications.",
  },
  "Synthesize Findings & Create Research Summary Report": {
    description:
      "Compile all findings (Market, Competitive, Audience, SWOT) into a comprehensive 15-25 page report.",
    why_matters:
      "Consolidates information into a single source of truth, ensuring the entire team operates from the same set of facts.",
    guiding_questions: [
      "What are the top 5 critical insights from the research?",
      "What are the primary opportunities to pursue?",
      "What are the biggest risks to manage?",
      "Are there any gaps that require further investigation?"
    ],
    expected_output:
      "Comprehensive Phase 1 Research Report synthesizing all findings.",
  },
  "Stakeholder Alignment & Sign-off": {
    description:
      "Present findings to leadership to ensure agreement on target audience, opportunities, and threats before moving to strategy.",
    why_matters:
      "Prevents costly pivots later by ensuring all decision-makers agree on the facts before creative work begins.",
    guiding_questions: [
      "Does the leadership team agree with the target customer definition?",
      "Are there any surprising findings that need discussion?",
      "Is there consensus on the key opportunities?",
      "Do we have formal approval to proceed to Phase 2?"
    ],
    expected_output:
      "Documented leadership sign-off on research conclusions.",
  },

  // ... KEEP THE REST OF YOUR EXISTING PHASE 2–8 ENTRIES UNCHANGED ...
  // For brevity, not repeating the entire existing object here, but in your file
  // you should leave every other key/value exactly as it was.
};