export interface StepGuidance {
  description: string;
  why_matters: string;
  guiding_questions: string[];
  expected_output: string;
}

export const stepGuidanceLibrary: Record<string, StepGuidance> = {
  // --- PRE-PHASE: KICKOFF ---
  "Project Kick-off & Objectives": {
    description:
      "Launch the initiative with a high-impact stakeholder workshop to align on vision, commercial goals, and decision-making hierarchy.",
    why_matters:
      "Prevents scope creep and strategic drift by establishing a unified definition of success before resources are committed.",
    guiding_questions: [
      "What specific business outcomes must this brand drive in the next 12–24 months?",
      "Which market opportunities or problems triggered this project right now?",
      "Who are the ultimate decision-makers, and how will approval be granted?",
      "What non-negotiable constraints (budget, timing, legacy assets) exist?"
    ],
    expected_output:
      "Strategic Kick-off Brief defining business goals, success metrics, and core stakeholders.",
  },

  // --- PHASE 1: DISCOVERY & RESEARCH ---
  "Define Your Project Scope & Research Objectives": {
    description:
      "Crystallize the research mandate. Define the exact commercial context, knowledge gaps, and the specific territories we need to explore.",
    why_matters:
      "Ensures high-ROI research by focusing resources only on the questions that will directly influence the brand strategy.",
    guiding_questions: [
      "What are the 'known unknowns' we must answer to win in this market?",
      "What is the precise geographic and demographic scope of this brand?",
      "Are we building a challenger brand, a category leader, or a niche player?"
    ],
    expected_output:
      "Research Charter outlining the scope, key hypotheses, and intelligence requirements.",
  },
  "Conduct Secondary Research (Desk Research)": {
    description:
      "Execute a deep-dive analysis of existing market intelligence, industry reports, and cultural trends to map the landscape.",
    why_matters:
      "Establishes a factual baseline of the market reality, ensuring our strategy is built on data, not assumptions.",
    guiding_questions: [
      "What is the Total Addressable Market (TAM) and its projected growth?",
      "Which macro-trends (cultural, technological, economic) are reshaping the category?",
      "Who are the incumbent leaders and the disruptive challengers?"
    ],
    expected_output:
      "Market Landscape Report (4-6 pages) summarizing key trends, size, and competitive forces.",
  },
  "Calculate Market Sizing (TAM, SAM, SOM)": {
    description:
      "Quantify the commercial opportunity by modeling the Total Addressable, Serviceable Available, and Serviceable Obtainable markets.",
    why_matters:
      "Validates the business case to investors and stakeholders by proving the revenue potential is worth the brand investment.",
    guiding_questions: [
      "What is the theoretical revenue ceiling if we dominated the entire market (TAM)?",
      "What segment can our current business model genuinely service (SAM)?",
      "What represents a realistic, winnable market share in years 1-3 (SOM)?"
    ],
    expected_output:
      "Market Valuation Model with clear TAM/SAM/SOM figures and growth logic.",
  },
  "Conduct Primary Research - Qualitative": {
    description:
      "Engage directly with target customers through in-depth interviews to uncover psychological drivers, hidden pain points, and emotional needs.",
    why_matters:
      "Data tells you *what* is happening; qualitative research tells you *why*. This is where true competitive insights are found.",
    guiding_questions: [
      "What emotional friction do customers feel with current solutions?",
      "What does a 'perfect' experience look like in their own words?",
      "Who influences their buying decision, and who holds the budget?"
    ],
    expected_output:
      "Customer Insight Deck featuring key themes, direct quotes, and preliminary persona sketches.",
  },
  "Conduct Primary Research - Quantitative": {
    description:
      "Validate qualitative hypotheses with statistical rigor through broad-scale surveys to identify patterns and segment priorities.",
    why_matters:
      "Provides the statistical confidence needed to make expensive strategic bets and prioritize feature development.",
    guiding_questions: [
      "Which pain points are the most acute across the broader market?",
      "How do different segments rank feature importance vs. price sensitivity?",
      "What is the verified Willingness to Pay (WTP) for our proposed value?"
    ],
    expected_output:
      "Quantitative Data Report with statistical validation of customer needs and preferences.",
  },
  "Conduct Existing Brand Audit": {
    description:
      "Perform a ruthless assessment of the current brand's performance, visual coherence, and market perception. (Skip for new ventures).",
    why_matters:
      "You can't navigate to a destination without knowing your starting point. Identifies brand equity to keep vs. baggage to cut.",
    guiding_questions: [
      "Does our visual identity look like a market leader or a follower?",
      "Is our messaging consistent across every single customer touchpoint?",
      "What is the delta between how we see ourselves and how the market sees us?"
    ],
    expected_output:
      "Brand Health Assessment scorecard highlighting equity gaps and inconsistencies.",
  },
  "Conduct SWOT Analysis": {
    description:
      "Synthesize all intelligence into a strategic framework (Strengths, Weaknesses, Opportunities, Threats) to isolate our winning angle.",
    why_matters:
      "Transforms raw information into strategic capability. It reveals exactly where we have the right to win.",
    guiding_questions: [
      "What unique unfair advantages do we possess internaly (Strengths)?",
      "Where are we vulnerable to competitor attacks (Weaknesses)?",
      "What market shifts can we exploit before others do (Opportunities)?",
      "What external forces could render our business model obsolete (Threats)?"
    ],
    expected_output: "Strategic SWOT Matrix with implied strategic directions.",
  },
  "Synthesize Findings & Create Research Summary Report": {
    description:
      "Distill weeks of research into a definitive 'State of the Nation' report that aligns the organization on a single version of the truth.",
    why_matters:
      "Ends internal debate. It ensures every creative and strategic decision moving forward is rooted in agreed-upon facts.",
    guiding_questions: [
      "What are the top 3 critical insights that must drive our strategy?",
      "Which market opportunities offer the highest value/lowest risk ratio?",
      "What are the 'elephants in the room' we must address?"
    ],
    expected_output:
      "Executive Research Abstract summarizing the path forward.",
  },
  "Stakeholder Alignment & Sign-off": {
    description:
      "Present the strategic case to leadership to secure formal buy-in on the target audience, market opportunity, and competitive positioning.",
    why_matters:
      "Mitigates risk. Securing alignment now prevents costly 'swoop and poop' interference during the creative phases.",
    guiding_questions: [
      "Does leadership unanimously agree on the Defined Target Customer?",
      "Are we aligned on the core opportunities we are attacking?",
      "Do we have the explicit mandate to proceed to Strategy Formulation?"
    ],
    expected_output:
      "Formal Sign-off Documentation approving the research conclusions.",
  },

  // --- PHASE 2: BRAND STRATEGY FOUNDATION ---
  "Brand Vision, Mission & Values": {
    description: "Codify the organization's North Star: our ultimate ambition (Vision), our daily purpose (Mission), and our non-negotiable beliefs (Values).",
    why_matters: "Culture eats strategy for breakfast. These pillars ensure your brand is built on a foundation that attracts the right talent and customers.",
    guiding_questions: [
      "Beyond profit, why does the world need this company? (Mission)",
      "If we succeed perfectly, what does the future look like? (Vision)",
      "What behaviors will we fire a top performer for violating? (Values)"
    ],
    expected_output: "Core Identity Framework defining Vision, Mission, and Cultural Values."
  },
  "Brand Positioning Statement": {
    description: "Engineer the internal logic of the brand: the target, the category, the benefit, and the proof.",
    why_matters: "This is the DNA of your marketing. If you cannot articulate your difference in one sentence, the market will never understand it.",
    guiding_questions: [
      "For [Target], [Brand] is the [Category] that [Benefit] because [Proof].",
      "What is the 'Onlyness' factor that separates us from the noise?",
      "Why should a cynical customer believe our promise?"
    ],
    expected_output: "Strategic Positioning Statement and Unique Selling Propositions (USPs)."
  },
  "Brand Personality & Archetypes": {
    description: "Design the brand's character. If the brand were a person, how would they speak, act, and connect?",
    why_matters: "Humans bond with personalities, not corporations. A defined archetype ensures consistent emotional resonance.",
    guiding_questions: [
      "Are we the Rebel, the Sage, the Lover, or the Ruler?",
      "What is our 'vibe' in three words (and what is it definitely NOT)?",
      "How do we behave when things go wrong?"
    ],
    expected_output: "Brand Persona Profile including Archetype mix and traits."
  },
  "Brand Messaging Framework": {
    description: "Develop the verbal armory: key messages, elevator pitches, and value pillars that the sales and marketing teams will use.",
    why_matters: "Consistency builds trust. This ensures every employee tells the same story, amplifying the brand's signal.",
    guiding_questions: [
      "What is the 30-second 'Elevator Pitch' that hooks the listener?",
      "What are the 3 pillars of value we deliver to every customer?",
      "What is the tagline that summarizes our promise?"
    ],
    expected_output: "Messaging Matrix with Value Pillars, Elevator Pitch, and Taglines."
  },
  "Brand Story": {
    description: "Craft the strategic narrative—the hero's journey of the brand that explains our origin, our struggle, and our purpose.",
    why_matters: "Facts tell, stories sell. A compelling origin story creates an emotional hook that features alone cannot achieve.",
    guiding_questions: [
      "What was the 'inciting incident' that forced this company to exist?",
      "Who is the villain in our customer's life that we help defeat?",
      "What is the transformation we promise?"
    ],
    expected_output: "Brand Narrative Document suitable for 'About Us' and investor decks."
  },

  // --- PHASE 3: VISUAL IDENTITY DESIGN ---
  "Mood Boards & Creative Direction": {
    description: "Explore distinct aesthetic territories to align on a visual strategy before commencing detailed design work.",
    why_matters: "Prevents subjective design debates. It aligns the team on a 'feeling' and 'style' before pixels are pushed.",
    guiding_questions: [
      "Does this visual route signal 'Premium' or 'Accessible'?",
      "Which aesthetic creates the strongest contrast with our competitors?",
      "Does this look appeal to the CEO, or to the Target Customer?"
    ],
    expected_output: "Visual Territory Boards (2-3 directions)."
  },
  "Logo Design Concepts": {
    description: "Translate the brand strategy into a primary visual mark that serves as the anchor for the entire identity system.",
    why_matters: "The logo is the shorthand for the brand's reputation. It must be distinctive, memorable, and functionally versatile.",
    guiding_questions: [
      "Does it work in black and white (fax/copy test)?",
      "Is it scalable from a favicon to a billboard?",
      "Does it conceptually link back to our Brand Promise?"
    ],
    expected_output: "Primary Logo Concepts (3 distinct routes) with application mockups."
  },
  "Color Palette Development": {
    description: "Select a strategic color system that leverages color psychology to evoke the right emotional response and category differentiation.",
    why_matters: "Color increases brand recognition by 80%. Owning a color is one of the most powerful branding moves possible.",
    guiding_questions: [
      "What emotions do these colors trigger in our specific culture?",
      "Does this palette have enough contrast for ADA accessibility?",
      "Does it stand out in the 'sea of sameness' of our competitors?"
    ],
    expected_output: "Strategic Color System with usage ratios and technical codes."
  },
  "Typography Selection": {
    description: "Curate a type system that communicates the brand's voice—whether authoritative, playful, modern, or traditional.",
    why_matters: "Typography is the voice of the brand in print. It subtly influences perception of quality and trust.",
    guiding_questions: [
      "Is the headline font distinctive enough to be recognized?",
      "Is the body font legible for long-form reading?",
      "Are the licensing costs sustainable for scaling?"
    ],
    expected_output: "Typography Hierarchy defining primary, secondary, and utility fonts."
  },
  "Imagery & Iconography Style": {
    description: "Define the visual language for photography, illustration, and data visualization.",
    why_matters: "Ensures that every image used—from a tweet to a billboard—feels like it comes from the same family.",
    guiding_questions: [
      "Are we using people, abstract shapes, or product macro shots?",
      "Do we want a 'gritty/authentic' look or a 'polished/aspirational' look?",
      "What is our unique illustration style?"
    ],
    expected_output: "Visual Asset Guidelines."
  },
  "Final Logo & Visual Identity Refinement": {
    description: "Rigorously polish the chosen identity system, perfecting kerning, balance, and technical scalability.",
    why_matters: "God is in the details. Technical flaws in a logo can cause expensive production issues later.",
    guiding_questions: [
      "Have we stress-tested the logo in every possible use case?",
      "Are all assets exported in the correct print and digital formats?",
      "Is the leadership team 100% committed to this direction?"
    ],
    expected_output: "Master Asset Library (SVG, PNG, EPS, AI)."
  },

  // --- PHASE 4: GUIDELINES & ASSETS ---
  "Brand Style Guide Creation": {
    description: "Codify the rules of engagement. Create the definitive manual for how to use (and not use) the brand assets.",
    why_matters: "Without a bible, the brand will dilute. This ensures consistency across agencies, freelancers, and internal teams.",
    guiding_questions: [
      "Is this guide simple enough for a non-designer to use?",
      "Have we explicitly shown 'Do Not' examples?",
      "Is it accessible to everyone who needs it?"
    ],
    expected_output: "Official Brand Guidelines Document (The Brand Book)."
  },
  "Core Brand Assets Package": {
    description: "Systematize and distribute the final assets into a Frictionless File Structure for the team.",
    why_matters: "If the right logo is hard to find, people will Google it and use the wrong one. Accessibility equals consistency.",
    guiding_questions: [
      "Is the naming convention logical and searchable?",
      "Does the team have the right file types (JPG vs PNG vs EPS)?",
      "Is there a central repository?"
    ],
    expected_output: "Organized Brand Asset Kit (Dropbox/Drive/DAM)."
  },
  "Brand Voice & Tone Guidelines": {
    description: "Create the playbook for copywriters and support staff on how to write 'on-brand'.",
    why_matters: "Ensures that a support ticket, a tweet, and a press release all sound like they come from the same entity.",
    guiding_questions: [
      "How does our tone flex from 'Good News' to 'Bad News'?",
      "What is our specific vocabulary (words we use vs. words we ban)?",
      "What does 'We' sound like?"
    ],
    expected_output: "Verbal Identity Guide with before/after writing examples."
  },

  // --- PHASE 5: IMPLEMENTATION ---
  "Website & Digital Presence Update": {
    description: "Reskin and realign the digital flagship (website) and social channels with the new identity.",
    why_matters: "This is the public face of the rebrand. Inconsistency here destroys credibility immediately.",
    guiding_questions: [
      "Does the homepage instantly communicate the new Value Prop?",
      "Are all social bios and avatars updated synchronously?",
      "Is the UX/UI consistent with the new Brand Personality?"
    ],
    expected_output: "Refreshed Website and Social Channels."
  },
  "Marketing Collateral Design": {
    description: "Update the sales engine. Redesign decks, one-pagers, and business cards.",
    why_matters: "Arm the sales team with tools that reflect the new premium positioning. Don't let them sell with old decks.",
    guiding_questions: [
      "Do the new sales decks tell the new story effectively?",
      "Are email signatures standardized?",
      "Is the print collateral ready for production?"
    ],
    expected_output: "Suite of Branded Templates (Slides, Docs, Email)."
  },
  "Packaging Design (if applicable)": {
    description: "Apply the new identity to physical product packaging for maximum shelf impact.",
    why_matters: "Packaging is the 'silent salesman'. It must communicate value and differentiation in seconds.",
    guiding_questions: [
      "Does it pop on the shelf vs. competitors?",
      "Is the information hierarchy clear?",
      "Is the unboxing experience shareable?"
    ],
    expected_output: "Production-Ready Packaging Dielines."
  },
  "Internal Communications & Training": {
    description: "Sell the brand inside before selling it outside. Train the team to be brand ambassadors.",
    why_matters: "Employees are the primary touchpoint. If they don't 'get' the brand, the customer never will.",
    guiding_questions: [
      "Does every employee understand the new Mission and Vision?",
      "Do they know where to find the new assets?",
      "Are they excited about the change?"
    ],
    expected_output: "Internal Launch Town Hall and Training Deck."
  },

  // --- PHASE 6: LAUNCH & ROLLOUT ---
  "Launch Strategy Development": {
    description: "Architect the Go-to-Market moment. Plan the sequence of events to maximize noise and impact.",
    why_matters: "You only launch once. A coordinated strike multiplies the media and market effect.",
    guiding_questions: [
      "Are we doing a 'Big Bang' or a 'Rolling Thunder' launch?",
      "What is the headline story for the press?",
      "What is the budget and timeline?"
    ],
    expected_output: "Go-to-Market Launch Plan."
  },
  "Communication Plan": {
    description: "Script the narrative for all audiences: customers, partners, press, and employees.",
    why_matters: "Controls the message. Prevents confusion and anxiety during the transition.",
    guiding_questions: [
      "How do we reassure existing clients?",
      "What is the hook for new prospects?",
      "What is the sequence of communications?"
    ],
    expected_output: "Communications Calendar and Drafted Scripts."
  },
  "Media & PR Strategy (if applicable)": {
    description: "Engage external amplifiers. Pitch the rebrand story to trade press and influencers.",
    why_matters: "Third-party validation builds authority and SEO equity.",
    guiding_questions: [
      "Who are the key journalists covering our sector?",
      "What is the larger industry trend this rebrand taps into?",
      "Do we have a press kit ready?"
    ],
    expected_output: "PR Target List and Media Kit."
  },
  "Digital Marketing Campaign Planning": {
    description: "Execute paid and organic campaigns to drive traffic to the new brand assets.",
    why_matters: "Ensures the rebrand is seen. Converts the 'buzz' into actual traffic and leads.",
    guiding_questions: [
      "Which channels offer the best reach for our target?",
      "What is the creative hook for the ads?",
      "What are the success metrics (KPIs)?"
    ],
    expected_output: "Launch Campaign Media Plan."
  },

  // --- PHASE 7: MONITORING ---
  "Brand Performance Metrics Definition": {
    description: "Establish the dashboard. Define exactly how we will measure the success of the brand.",
    why_matters: "If you can't measure it, you can't manage it. Proves ROI to the board.",
    guiding_questions: [
      "How do we track Brand Awareness (Search volume, Direct traffic)?",
      "How do we track Sentiment (NPS, Reviews)?",
      "What are the leading vs lagging indicators?"
    ],
    expected_output: "Brand Performance Dashboard Setup."
  },
  "Initial Brand Audit & Feedback Collection": {
    description: "The post-launch health check. Gather immediate feedback to identify issues.",
    why_matters: "Catches implementation errors early. Shows customers we care about their experience.",
    guiding_questions: [
      "Are customers confused by the change?",
      "Is the internal team using the assets correctly?",
      "What is the initial social media reaction?"
    ],
    expected_output: "Post-Launch Feedback Report."
  },
  "Marketing Campaign Performance Review": {
    description: "Analyze the launch data. What worked, what failed, and where do we double down?",
    why_matters: "Optimizes spend. Ensures we stop wasting money on ineffective channels.",
    guiding_questions: [
      "Which channel drove the highest quality leads?",
      "Did the creative message resonate?",
      "What was the CPA (Cost Per Acquisition)?"
    ],
    expected_output: "Campaign Retro & Optimization Plan."
  },
  "Brand Refinement & Iteration": {
    description: "Agile branding. Make data-driven tweaks to the guidelines based on real-world usage.",
    why_matters: "A brand is a living system. It must evolve to fit reality.",
    guiding_questions: [
      "What assets are missing from the library?",
      "Do we need to tighten the voice guidelines?",
      "Are there accessibility issues to fix?"
    ],
    expected_output: "Brand Guidelines V1.1 Update."
  },

  // --- PHASE 8: LONG-TERM MANAGEMENT ---
  "Ongoing Brand Monitoring": {
    description: "Set up the radar. Continuous listening for competitive moves and brand sentiment.",
    why_matters: "Protects reputation. Ensures you aren't blindsided by a PR crisis or competitor pivot.",
    guiding_questions: [
      "Who is monitoring social listening tools?",
      "How often do we review competitor creative?",
      "What is the protocol for negative PR?"
    ],
    expected_output: "Quarterly Brand Health Review Process."
  },
  "Brand Extension Strategy": {
    description: "Plan the future. How does the brand stretch into new products or markets?",
    why_matters: "Prevents brand dilution. Ensures new launches strengthen rather than confuse the core brand.",
    guiding_questions: [
      "Does this new product fit the Brand Promise?",
      "Do we need a sub-brand architecture?",
      "Will this stretch the brand too thin?"
    ],
    expected_output: "Brand Architecture & Extension Framework."
  },
  "Brand Evolution Planning": {
    description: "The long game. Schedule strategic reviews to keep the brand modern.",
    why_matters: "Prevents obsolescence. Ensures the brand matures with its market.",
    guiding_questions: [
      "Is our visual identity still feeling fresh?",
      "Has the customer profile shifted?",
      "Do we need to refresh photography or voice?"
    ],
    expected_output: "Annual Strategy Review Schedule."
  },
  "Intellectual Property Management": {
    description: "Protect the asset. Manage trademarks, domains, and copyrights.",
    why_matters: "The brand is a financial asset. Failure to protect IP destroys value.",
    guiding_questions: [
      "Are our trademarks up for renewal?",
      "Do we need to register in new territories?",
      "Are we policing unauthorized use?"
    ],
    expected_output: "IP Asset Register & Maintenance Schedule."
  }
};