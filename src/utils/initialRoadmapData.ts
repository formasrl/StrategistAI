import { stepGuidanceLibrary } from '@/utils/stepGuidanceData';

interface InitialStep {
  step_number: number;
  step_name: string;
  description?: string;
  why_matters?: string;
  dependencies?: string[];
  timeline?: string;
  order_index: number;
  guiding_questions?: string[];
  expected_output?: string;
}

interface InitialPhase {
  phase_number: number;
  phase_name: string;
  description: string;
  steps: InitialStep[];
}

// Helper to safely get data from the library
const getStepData = (stepName: string) => {
  const data = stepGuidanceLibrary[stepName];
  if (!data) {
    console.warn(`Missing guidance data for step: ${stepName}`);
    return {
      description: "",
      why_matters: "",
      guiding_questions: [],
      expected_output: ""
    };
  }
  return {
    description: data.description,
    why_matters: data.why_matters,
    guiding_questions: data.guiding_questions,
    expected_output: data.expected_output
  };
};

export const initialRoadmapData: InitialPhase[] = [
  {
    phase_number: 1,
    phase_name: "Discovery & Research",
    description: "Understand the market, audience, and business context to build a solid foundation.",
    steps: [
      {
        step_number: 1,
        step_name: "Project Kick-off & Objectives",
        ...getStepData("Project Kick-off & Objectives"),
        dependencies: [],
        timeline: "Week 1",
        order_index: 0,
      },
      {
        step_number: 2,
        step_name: "Define Your Project Scope & Research Objectives",
        ...getStepData("Define Your Project Scope & Research Objectives"),
        dependencies: [],
        timeline: "Week 1",
        order_index: 1,
      },
      {
        step_number: 3,
        step_name: "Conduct Secondary Research (Desk Research)",
        ...getStepData("Conduct Secondary Research (Desk Research)"),
        dependencies: ["Define Your Project Scope & Research Objectives"],
        timeline: "Week 1-2",
        order_index: 2,
      },
      {
        step_number: 4,
        step_name: "Calculate Market Sizing (TAM, SAM, SOM)",
        ...getStepData("Calculate Market Sizing (TAM, SAM, SOM)"),
        dependencies: ["Conduct Secondary Research (Desk Research)"],
        timeline: "Week 2",
        order_index: 3,
      },
      {
        step_number: 5,
        step_name: "Conduct Primary Research - Qualitative",
        ...getStepData("Conduct Primary Research - Qualitative"),
        dependencies: ["Conduct Secondary Research (Desk Research)"],
        timeline: "Week 2-3",
        order_index: 4,
      },
      {
        step_number: 6,
        step_name: "Conduct Primary Research - Quantitative",
        ...getStepData("Conduct Primary Research - Quantitative"),
        dependencies: ["Conduct Primary Research - Qualitative"],
        timeline: "Week 3-4",
        order_index: 5,
      },
      {
        step_number: 7,
        step_name: "Conduct Existing Brand Audit",
        ...getStepData("Conduct Existing Brand Audit"),
        dependencies: ["Define Your Project Scope & Research Objectives"],
        timeline: "Week 2",
        order_index: 6,
      },
      {
        step_number: 8,
        step_name: "Conduct SWOT Analysis",
        ...getStepData("Conduct SWOT Analysis"),
        dependencies: ["Conduct Primary Research - Quantitative", "Conduct Existing Brand Audit"],
        timeline: "Week 4",
        order_index: 7,
      },
      {
        step_number: 9,
        step_name: "Synthesize Findings & Create Research Summary Report",
        ...getStepData("Synthesize Findings & Create Research Summary Report"),
        dependencies: ["Conduct SWOT Analysis"],
        timeline: "Week 5",
        order_index: 8,
      },
      {
        step_number: 10,
        step_name: "Stakeholder Alignment & Sign-off",
        ...getStepData("Stakeholder Alignment & Sign-off"),
        dependencies: ["Synthesize Findings & Create Research Summary Report"],
        timeline: "Week 5",
        order_index: 9,
      },
    ],
  },

  // PHASES 2–8: keep exactly as you already have them,
  // but ensure every step uses ...getStepData("Exact Name From Library")
  // rather than hand-writing description/why_matters/guiding_questions/expected_output.
  // The rest of your file should remain structurally the same, just driven by getStepData.
];