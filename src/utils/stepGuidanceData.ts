// src/utils/stepGuidanceData.ts

export interface StepGuidance {
  description: string;
  why_matters: string;
  guiding_questions: string[];
  expected_output: string;
}

export const stepGuidanceLibrary: Record<string, StepGuidance> = {
  // --- PHASE 1: DISCOVERY & RESEARCH ---
  "Define Your Project Scope & Research Objectives": {
    description: "Clarify exactly what you need to research and why. Define the business context, establish specific research objectives, and set the timeline and budget.",
    why_matters: "Ensures alignment between the client and the branding team from the outset, setting clear objectives and scope to prevent wasted effort.",
    guiding_questions: [
      "What specific questions do you need answered by the end of this phase?",
      "What is the geographic scope of your project?",
      "Are you starting fresh, rebranding, or entering a new market?",
      "Who needs to be part of the core research team?"
    ],
    expected_output: "Research objectives document outlining scope, timeline, and team responsibilities."
  },
  "Conduct Secondary Research (Desk Research)": {
    description: "Gather existing data about your market, industry, and competitors from published sources like industry reports, government datasets, and news articles.",
    why_matters: "Provides a baseline understanding of the market landscape and competitive environment before investing in primary research.",
    guiding_questions: [
      "What is the current market size and growth trajectory?",
      "What are the top 3-5 trends driving the market?",
      "Who are the direct and indirect competitors?",
      "What emerging technologies are affecting the industry?"
    ],
    expected_output: "Secondary Research Report (4-6 pages) summarizing market overview, trends, and preliminary insights."
  },
  "Calculate Market Sizing (TAM, SAM, SOM)": {
    description: "Estimate the Total Addressable Market, Serviceable Available Market, and Serviceable Obtainable Market to understand the actual size of the opportunity.",
    why_matters: "Validates the business model and helps set realistic growth targets based on actual market potential.",
    guiding_questions: [
      "What is the total revenue opportunity if you reached 100% of the market (TAM)?",
      "What portion can you realistically serve based on your business model (SAM)?",
      "What is your realistic market share target for years 1-3 (SOM)?",
      "Which calculation method (Top-Down vs Bottom-Up) yields more reliable data?"
    ],
    expected_output: "Market Sizing Analysis with TAM/SAM/SOM figures and methodology explained."
  },
  "Conduct Primary Research - Qualitative": {
    description: "Speak directly with potential customers and stakeholders through 1-on-1 interviews or focus groups to understand deep motivations and pain points.",
    why_matters: "Uncovers the 'why' behind customer behaviors that quantitative data often misses.",
    guiding_questions: [
      "What frustrates customers most about current solutions?",
      "How do they currently solve this problem?",
      "What would an ideal solution look like to them?",
      "Who is involved in their decision-making process?"
    ],
    expected_output: "Qualitative Research Summary including interview themes, quotes, and preliminary personas."
  },
  "Conduct Primary Research - Quantitative": {
    description: "Gather numerical data through customer surveys (min 100 responses) to validate qualitative findings, rank pain points, and identify trends.",
    why_matters: "Provides statistical backing for strategic decisions and validates hypotheses from interviews.",
    guiding_questions: [
      "How frequently do customers face the specific problem?",
      "How do they rank the importance of different features/capabilities?",
      "What is their willingness to pay?",
      "Which demographic segments show the strongest interest?"
    ],
    expected_output: "Quantitative Research Summary with survey results, charts, and data validation."
  },
  "Conduct Existing Brand Audit": {
    description: "Assess how the current brand performs and is perceived regarding visual identity, messaging, and market positioning. (Skip if new startup).",
    why_matters: "Identifies the gap between current reality and desired perception, highlighting exactly what needs to change.",
    guiding_questions: [
      "Is the visual identity consistent across all touchpoints?",
      "Does current messaging align with the customer needs identified?",
      "How does the brand sentiment compare to competitors?",
      "What are the biggest gaps between current and desired positioning?"
    ],
    expected_output: "Brand Audit Report highlighting visual/messaging strengths, weaknesses, and gaps."
  },
  "Conduct SWOT Analysis": {
    description: "Synthesize all research into a strategic overview (Strengths, Weaknesses, Opportunities, Threats) to identify competitive advantages.",
    why_matters: "Transforms raw data into actionable strategic insights, highlighting where to play and how to win.",
    guiding_questions: [
      "What unique internal capabilities do we have (Strengths)?",
      "What resources do we lack (Weaknesses)?",
      "What market trends can we capitalize on (Opportunities)?",
      "What external factors could disrupt us (Threats)?"
    ],
    expected_output: "SWOT Matrix & Analysis document with strategic implications."
  },
  "Synthesize Findings & Create Research Summary Report": {
    description: "Compile all findings (Market, Competitive, Audience, SWOT) into a comprehensive 15-25 page report.",
    why_matters: "Consolidates information into a single source of truth, ensuring the entire team operates from the same set of facts.",
    guiding_questions: [
      "What are the top 5 critical insights from the research?",
      "What are the primary opportunities to pursue?",
      "What are the biggest risks to manage?",
      "Are there any gaps that require further investigation?"
    ],
    expected_output: "Comprehensive Phase 1 Research Report synthesizing all findings."
  },
  "Stakeholder Alignment & Sign-off": {
    description: "Present findings to leadership to ensure agreement on target audience, opportunities, and threats before moving to strategy.",
    why_matters: "Prevents costly pivots later by ensuring all decision-makers agree on the facts before creative work begins.",
    guiding_questions: [
      "Does the leadership team agree with the target customer definition?",
      "Are there any surprising findings that need discussion?",
      "Is there consensus on the key opportunities?",
      "Do we have formal approval to proceed to Phase 2?"
    ],
    expected_output: "Documented leadership sign-off on research conclusions."
  },

  // --- PHASE 2: BRAND STRATEGY FOUNDATION ---
  "Prepare for Strategy Workshops": {
    description: "Set up conditions for successful strategy definition. Secure stakeholder buy-in, assemble the right team, and prepare materials.",
    why_matters: "Strategy requires alignment. Ensuring the right people are in the room with the right mindset prevents rejection later.",
    guiding_questions: [
      "Who are the core decision-makers that must be present?",
      "What pre-read materials does the team need?",
      "Who will facilitate the sessions to ensure equal input?",
      "What are the specific goals for the workshop days?"
    ],
    expected_output: "Workshop plan document including agenda, participant list, and logistics."
  },
  "Define Brand Purpose, Vision & Mission": {
    description: "Establish why your brand exists (Purpose), where it's heading (Vision), and what you do every day to get there (Mission).",
    why_matters: "Forms the philosophical core of the brand, guiding all future decisions, culture, and communications.",
    guiding_questions: [
      "Why does the brand exist beyond making money?",
      "What specific future are you creating for your customers?",
      "What do you do, for whom, and how?",
      "Do these statements inspire the team?"
    ],
    expected_output: "Draft Purpose, Vision, and Mission statements with team agreement."
  },
  "Identify Core Values": {
    description: "Define the principles that guide how you operate. Identify 3-5 core values and define what they mean in practice.",
    why_matters: "Values guide culture and behavior. Defining them clearly ensures consistency in customer experience.",
    guiding_questions: [
      "What principles would we keep even if they cost us money?",
      "What behaviors do we want to reward?",
      "How do these values distinguish us from competitors?",
      "Can we pass the 'Monday Morning Test' with these values?"
    ],
    expected_output: "3-5 Core Values with clear definitions and behavioral examples."
  },
  "Develop Brand Personality & Archetype": {
    description: "Define your brand's character—how it acts, speaks, and relates. Choose a primary and secondary Brand Archetype.",
    why_matters: "Humanizes the brand, making it relatable and helping to shape a consistent voice and visual style.",
    guiding_questions: [
      "If your brand were a person, who would it be?",
      "Which archetype best represents your motivation (e.g., Hero, Sage, Creator)?",
      "Are you formal or casual? Serious or playful?",
      "How do you relate to your customers?"
    ],
    expected_output: "Defined Brand Personality with Archetype, traits, and behavioral manifestations."
  },
  "Identify Key Differentiators": {
    description: "Determine what makes you uniquely valuable. Score potential differentiators on Meaning, Uniqueness, and Defensibility (MUD).",
    why_matters: "Differentiation is the key to competitive advantage. You must identify what you can truly own.",
    guiding_questions: [
      "What can we do that competitors effectively cannot?",
      "Does this differentiator actually matter to the customer?",
      "Is this advantage sustainable?",
      "Do we have proof/evidence for this claim?"
    ],
    expected_output: "3-5 Core Differentiators with MUD scores and customer validation notes."
  },
  "Craft Brand Positioning Statement": {
    description: "Articulate your brand's unique value proposition in one clear statement using the standard formula: Target, Category, Benefit, Proof.",
    why_matters: "Provides a clear internal compass for all marketing and communication efforts, ensuring consistency.",
    guiding_questions: [
      "Who is your specific target audience?",
      "What is their primary pain point?",
      "What is your unique solution and benefit?",
      "Why should they believe you (proof points)?"
    ],
    expected_output: "Final Positioning Statement, Reasons to Believe, Brand Promise, and Value Proposition."
  },
  "Create Brand Personality & Tone of Voice Guidelines (Initial)": {
    description: "Establish initial guidelines for how your brand communicates. Define where you sit on spectrums like Formal/Casual.",
    why_matters: "Ensures that the brand sounds the same across all touchpoints, building recognition and trust.",
    guiding_questions: [
      "What 3 adjectives describe your brand's voice?",
      "Do you use slang/jargon or plain English?",
      "Are you an expert authority or a helpful friend?",
      "What words or phrases do you never use?"
    ],
    expected_output: "Initial Brand Voice Framework defining tone attributes."
  },
  "Develop Preliminary Messaging Framework": {
    description: "Create the core messages and supporting pillars. Define the 'Elevator Pitch' and 3-5 key messaging pillars with proof points.",
    why_matters: "Ensures consistent and compelling communication across all touchpoints.",
    guiding_questions: [
      "What is the one thing you want people to remember about you?",
      "What are the 3 main benefits you deliver?",
      "What evidence supports each of these benefits?",
      "How does this messaging address customer objections?"
    ],
    expected_output: "Preliminary Messaging Framework with core message, pillars, and proof points."
  },
  "Create Brand Identity Requirements Brief": {
    description: "Translate brand strategy into visual design direction. Define visual keywords, inspiration, and 'don'ts' for the design phase.",
    why_matters: "Bridges the gap between strategy and design, ensuring the visual identity will authentically reflect the strategy.",
    guiding_questions: [
      "What visual words describe your brand (e.g., modern, bold)?",
      "What other brands have a visual style you admire?",
      "What visual clichés should be avoided?",
      "What are the technical requirements for your logo?"
    ],
    expected_output: "Visual Identity Design Brief to guide Phase 4 design work."
  },
  "Synthesize and Document Brand Strategy Framework": {
    description: "Create the master document that synthesizes all Phase 2 work into a Brand Strategy Framework.",
    why_matters: "Serves as the 'North Star' document for the organization, ensuring everyone is aligned on the brand foundation.",
    guiding_questions: [
      "Does the framework tell a coherent story?",
      "Is every decision grounded in the research?",
      "Has leadership signed off on all key elements?",
      "Is the document clear enough to hand to a new employee?"
    ],
    expected_output: "Complete Brand Strategy Framework document (20-30 pages) with leadership sign-off."
  },

  // --- PHASE 3: VISUAL IDENTITY ---
  "Recruit and Brief Design Partner": {
    description: "Secure design expertise (In-house, Freelance, or Agency) and ensure clear communication of strategic direction via the Design Brief.",
    why_matters: "The quality of the visual outcome depends heavily on the partner chosen and the clarity of the brief they receive.",
    guiding_questions: [
      "Does the partner's portfolio align with our desired aesthetic?",
      "Have we clearly communicated our brand strategy?",
      "Is the budget and timeline realistic?",
      "Do they have experience with comprehensive branding systems?"
    ],
    expected_output: "Comprehensive Design Brief sent to partner and project kickoff scheduled."
  },
  "Logo Concepts & Direction Setting": {
    description: "Generate initial logo concepts based on the brief. Review 3-5 strong concepts and select a direction for refinement.",
    why_matters: "The logo is the visual anchor of the brand. Exploring multiple directions ensures the final choice is strategic.",
    guiding_questions: [
      "Does this concept reflect our brand personality?",
      "Is it distinct from competitors?",
      "Will it work in small sizes (e.g., favicon) and large formats?",
      "Does it have longevity?"
    ],
    expected_output: "Presentation feedback summary and selection of one direction for refinement."
  },
  "Logo Refinement & Selection": {
    description: "Narrow down and perfect the chosen logo concept. Test scalability, variations, and monochrome versions.",
    why_matters: "Ensures the logo is technically sound, versatile across all media, and polished to a professional standard.",
    guiding_questions: [
      "Is the logo legible at small sizes?",
      "Does it work in black and white?",
      "Have we tested it against competitor logos?",
      "Are the proportions and spacing balanced?"
    ],
    expected_output: "Final approved logo design in all required formats."
  },
  "Develop Color Palette": {
    description: "Create a comprehensive color system including primary, secondary, and neutral colors with specific codes.",
    why_matters: "Color evokes emotion and builds recognition. A system ensures consistency across digital and print media.",
    guiding_questions: [
      "Do these colors convey the right emotion?",
      "Is there enough contrast for accessibility?",
      "Do we have enough range for UI design?",
      "Are these colors distinct in our industry?"
    ],
    expected_output: "Final Color Palette with all color codes and usage guidelines."
  },
  "Select Typography": {
    description: "Choose primary (headers) and secondary (body) typefaces that reflect brand personality and are legible.",
    why_matters: "Typography conveys personality subtlely but powerfully. It affects readability and user experience.",
    guiding_questions: [
      "Is the body font easy to read?",
      "Does the header font have character that matches our brand?",
      "Are the fonts available for web and print?",
      "Do the two fonts pair well together?"
    ],
    expected_output: "Final Typography System with font files, weights, and hierarchy defined."
  },
  "Define Imagery Style & Guidelines": {
    description: "Establish consistent visual language for photography, illustrations, and icons. Create a mood board and usage rules.",
    why_matters: "Visuals process faster than text. Consistent imagery style creates a cohesive brand atmosphere.",
    guiding_questions: [
      "Is our photography candid or staged?",
      "What subjects do we show?",
      "What is the lighting and color treatment style?",
      "Are icons solid, outlined, or flat?"
    ],
    expected_output: "Imagery Style Guide including photography mood board and icon specifications."
  },
  "Create Visual Identity Mockups & Applications": {
    description: "Apply the new identity to real-world mockups (website, business cards, ads) to test versatility.",
    why_matters: "Verifies that the system works in practice, not just in theory. Helps stakeholders visualize the future brand.",
    guiding_questions: [
      "Does the brand look consistent across different mediums?",
      "Is the logo legible on top of images?",
      "Do the colors hold up in print vs screen?",
      "Does the overall look feel cohesive?"
    ],
    expected_output: "Visual Identity Mockup presentation showing key applications."
  },
  "Prepare Final Deliverables": {
    description: "Organize all visual files (Logos, Fonts, Patterns) and documentation. Ensure proper naming and formats.",
    why_matters: "Ensures that the team can actually use the new brand assets easily and correctly.",
    guiding_questions: [
      "Do we have vector and raster files?",
      "Are files named clearly?",
      "Are font licenses secured?",
      "Is there a 'Read Me' or guide for usage?"
    ],
    expected_output: "Organized Master Asset Folder with all final files and specifications."
  },
  "Gather Customer Validation": {
    description: "Optional but recommended: Test the visual identity with a small group of target customers.",
    why_matters: "Validates that the visual language communicates the intended values to the people who matter most.",
    guiding_questions: [
      "What words do customers use to describe the new look?",
      "Do they find it trustworthy/innovative?",
      "Is it confusing or similar to another brand?",
      "Does it stand out?"
    ],
    expected_output: "Customer Validation Report (if conducted)."
  },
  "Get Final Approval & Handoff to Phase 4": {
    description: "Secure final leadership sign-off on the entire system and hand off files for the Guidelines phase.",
    why_matters: "Formalizes the decision and marks the transition from creation to documentation/implementation.",
    guiding_questions: [
      "Is leadership fully aligned?",
      "Are there any lingering concerns?",
      "Is the team ready for documentation?",
      "Who will own the asset library?"
    ],
    expected_output: "Signed-off Visual Identity System and handoff documentation."
  },

  // --- PHASE 4: GUIDELINES ---
  "Plan Your Brand Guidelines Structure": {
    description: "Determine the scope, audience, and format (PDF, Web) of your guidelines. Create a content outline.",
    why_matters: "Ensures the guidelines document is actually useful for the people who will use it.",
    guiding_questions: [
      "Who is the primary audience?",
      "Will a digital PDF or a web-based portal be better?",
      "How comprehensive do we need to be?",
      "What specific sections are critical?"
    ],
    expected_output: "Brand Guidelines Outline and Format Plan."
  },
  "Gather and Organize All Brand Assets": {
    description: "Collect all finalized Strategy and Visual Identity components from Phases 2 & 3. Prepare visual examples.",
    why_matters: "Organization is key to an efficient documentation process. You need all the 'raw materials' ready.",
    guiding_questions: [
      "Do we have the final logo files?",
      "Are the strategy documents final?",
      "Do we have 'Bad' examples to show what NOT to do?",
      "Are all image assets high-resolution?"
    ],
    expected_output: "Organized folder of all assets ready for layout."
  },
  "Design the Brand Guidelines Document": {
    description: "Create the visual layout of the document itself. Establish the grid, typography, and style of the guide.",
    why_matters: "The guidelines document is the first piece of 'branded content' people see. It must embody the brand.",
    guiding_questions: [
      "Does the document design reflect the brand personality?",
      "Is the layout clean and easy to scan?",
      "Are we using our own fonts and colors correctly?",
      "Is there a clear hierarchy?"
    ],
    expected_output: "Designed draft of the Brand Guidelines document structure."
  },
  "Write Clear, Actionable Guidelines": {
    description: "Write the rules and explanations for each section (Logo, Color, Voice, etc.). Be prescriptive but helpful.",
    why_matters: "Ambiguous rules lead to inconsistency. Clear instructions empower teams to create on-brand work independently.",
    guiding_questions: [
      "Are the rules simple to understand?",
      "Did we explain WHY a rule exists?",
      "Are we using 'Do' and 'Don't' examples effectively?",
      "Is the tone helpful?"
    ],
    expected_output: "Draft content for all sections including Introduction, Identity, and Voice."
  },
  "Review and Refine with Stakeholders": {
    description: "Get feedback from key users (designers, writers) and leadership. Test the guidelines for usability.",
    why_matters: "Ensures the guidelines are practical and cover real-world edge cases before they are finalized.",
    guiding_questions: [
      "Can a designer easily find the clear space rule?",
      "Does a writer understand the voice nuances?",
      "Are there any scenarios we missed?",
      "Is leadership happy?"
    ],
    expected_output: "Revised Brand Guidelines incorporating stakeholder feedback."
  },
  "Finalize and Prepare for Distribution": {
    description: "Create final file versions (Hi-res PDF, Web-optimized PDF). Create supporting assets like a Quick Reference Guide.",
    why_matters: "Different users need different formats. Preparation ensures smooth adoption.",
    guiding_questions: [
      "Is the file size manageable?",
      "Do all links work?",
      "Is the Quick Reference Guide truly one page?",
      "Are the asset links pointing to the correct library?"
    ],
    expected_output: "Final Brand Guidelines PDF, Web version, and Quick Reference Guide."
  },
  "Launch and Distribute Brand Guidelines": {
    description: "Officially release the guidelines to the organization. Conduct a launch event or communication campaign.",
    why_matters: "A quiet launch leads to low adoption. You need to generate awareness and authority for the new standards.",
    guiding_questions: [
      "How will we announce this to the company?",
      "Who needs specific access permissions?",
      "Where will the 'Source of Truth' live?",
      "How do we ensure old guidelines are retired?"
    ],
    expected_output: "Distributed guidelines and completed internal launch communication."
  },
  "Establish Governance and Approval Processes": {
    description: "Define who needs to approve what. Create workflows for Tier 1, 2, and 3 assets.",
    why_matters: "Prevents bottlenecks while maintaining quality. Clarifies when 'Self-Service' is okay.",
    guiding_questions: [
      "What materials require Brand Manager approval?",
      "What can departments create on their own?",
      "What is the SLA for reviewing approvals?",
      "How do people submit requests?"
    ],
    expected_output: "Documented Brand Governance / Approval Workflow."
  },
  "Measure Adoption and Effectiveness": {
    description: "Set up metrics to track guideline usage (downloads, views) and brand consistency.",
    why_matters: "You can't manage what you don't measure. Knowing if guidelines are used helps justify ROI.",
    guiding_questions: [
      "How many people have downloaded the PDF?",
      "Are we seeing fewer 'off-brand' mistakes?",
      "What is the feedback from the team?",
      "Are templates being used?"
    ],
    expected_output: "Measurement Framework for tracking adoption."
  },
  "Maintain and Evolve Guidelines": {
    description: "Plan for annual reviews and updates. The brand is living, and guidelines must evolve.",
    why_matters: "Stagnant guidelines become irrelevant. Regular updates keep the brand fresh and functional.",
    guiding_questions: [
      "How often will we review the guidelines?",
      "What is the process for requesting an update?",
      "How do we handle new channels?",
      "Who is responsible for the master document?"
    ],
    expected_output: "Maintenance and Evolution Plan."
  },

  // --- PHASE 5: MARKETING COLLATERAL ---
  "Audit Existing Materials and Define Needs": {
    description: "Inventory all current marketing materials. Assess what needs updating, what to retire, and what new assets are needed.",
    why_matters: "Prevents waste by identifying what can be repurposed and prioritizes the most critical gaps.",
    guiding_questions: [
      "What materials are currently 'off-brand'?",
      "What assets does the sales team request most often?",
      "Which high-priority items are needed for launch?",
      "What is the budget for production?"
    ],
    expected_output: "Collateral Audit and Production Plan/Prioritized List."
  },
  "Establish Collateral Production Workflow": {
    description: "Define roles (Writer, Designer, Approver) and the process for creating new materials.",
    why_matters: "Streamlines creation, reduces errors, and ensures every piece is reviewed for brand compliance.",
    guiding_questions: [
      "Who is responsible for writing copy?",
      "Who approves the final design?",
      "Where are files stored?",
      "What is the typical timeline?"
    ],
    expected_output: "Documented Production Workflow and Creative Brief Template."
  },
  "Produce Core Business Materials": {
    description: "Design and produce essentials: Business cards, email signatures, letterhead, and company overview.",
    why_matters: "These are the daily touchpoints of the business. Consistency here builds professional credibility immediately.",
    guiding_questions: [
      "Do all employees have updated email signatures?",
      "Is the letterhead available in digital format?",
      "Is the 'About Us' one-pager accurate?",
      "Are business cards ready for print?"
    ],
    expected_output: "Core Business Materials Suite (Digital & Print ready)."
  },
  "Develop Sales Enablement Materials": {
    description: "Create the Sales Deck, Product One-Pagers, Case Studies, and Pricing Sheets.",
    why_matters: "Empowers the sales team to sell effectively and consistently. Direct impact on revenue.",
    guiding_questions: [
      "Does the sales deck tell a compelling story?",
      "Are the case studies focused on customer results?",
      "Is the pricing easy to understand?",
      "Do these assets help handle objections?"
    ],
    expected_output: "Complete Sales Enablement Suite."
  },
  "Create Marketing Communications Materials": {
    description: "Update the Website, Email Newsletter templates, Social Media templates, and Lead Magnets.",
    why_matters: "Ensures that your public-facing marketing channels are fully branded and ready for campaigns.",
    guiding_questions: [
      "Is the website fully updated?",
      "Are email templates mobile-responsive?",
      "Do social templates cover all post types?",
      "Are lead magnets valuable?"
    ],
    expected_output: "Marketing Communications Suite."
  },
  "Produce Advertising and Promotional Materials": {
    description: "Create Digital Ads, Print Ads, Event materials (booths, swag), and Landing Pages.",
    why_matters: "Paid media requires high-quality assets to convert. Events need strong visual presence to stand out.",
    guiding_questions: [
      "Do ads have clear calls to action?",
      "Are event materials legible from a distance?",
      "Do landing pages match the ad promise?",
      "Is promotional swag high quality?"
    ],
    expected_output: "Advertising and Promotional Materials Suite."
  },
  "Organize and Manage Brand Asset Library": {
    description: "Set up a Digital Asset Management (DAM) system or organized folder structure. Implement naming conventions.",
    why_matters: "If teams can't find the right logo, they will use the wrong one. Access is key to compliance.",
    guiding_questions: [
      "Is the folder structure intuitive?",
      "Are file names consistent?",
      "Who has access to edit vs view?",
      "Is there a user guide?"
    ],
    expected_output: "Organized, Accessible Brand Asset Library."
  },
  "Distribute Collateral and Train Teams": {
    description: "Hand off materials to the respective teams (Sales, Marketing, HR). Train them on usage.",
    why_matters: "Assets are useless if they sit in a folder. Training ensures adoption and correct usage.",
    guiding_questions: [
      "Does the sales team know where to find the new deck?",
      "Does HR have the new onboarding packet?",
      "Have we demoed the templates?",
      "Are there usage guidelines?"
    ],
    expected_output: "Teams trained and collateral distributed."
  },
  "Monitor Usage and Gather Feedback": {
    description: "Track downloads and ask teams what's working and what's missing.",
    why_matters: "Continuous improvement. Identifying gaps early prevents 'rogue' asset creation.",
    guiding_questions: [
      "Which assets are most used?",
      "What are teams asking for that we don't have?",
      "Are templates being broken?",
      "Is the feedback loop active?"
    ],
    expected_output: "Usage Report and Feedback Log."
  },

  // --- PHASE 6: LAUNCH ---
  "Create Comprehensive Launch Plan": {
    description: "Develop a detailed plan outlining timeline, roles, KPIs, and contingency plans for the brand launch.",
    why_matters: "A coordinated launch maximizes impact and minimizes confusion. You only get one chance to launch first.",
    guiding_questions: [
      "What are the primary objectives?",
      "Who is responsible for each channel?",
      "What is the backup plan?",
      "What are our success metrics (KPIs)?"
    ],
    expected_output: "Launch Plan Document with timeline and roles."
  },
  "Conduct Internal Alignment and Training": {
    description: "Ensure every employee understands the brand and their role in it before the public sees it.",
    why_matters: "Employees are your primary brand ambassadors. If they don't buy in, the market won't either.",
    guiding_questions: [
      "Has leadership been briefed?",
      "Is there an All-Hands meeting scheduled?",
      "Do customer-facing teams have scripts?",
      "Is there internal excitement?"
    ],
    expected_output: "Internal Launch Event and Training Completion."
  },
  "Prepare All External Touchpoints": {
    description: "Stage all updates for Website, Social Media, Email, and Physical locations so they can go live simultaneously.",
    why_matters: "Consistency at launch builds trust. A fragmented launch looks unprofessional.",
    guiding_questions: [
      "Is the website staged and tested?",
      "Are social media profiles ready?",
      "Have partners been notified?",
      "Are customer emails drafted?"
    ],
    expected_output: "All external touchpoints ready for 'Go Live'."
  },
  "Execute Launch Sequence": {
    description: "Activate the launch. Switch website, send emails, post to social, issue press release.",
    why_matters: "The moment of truth. Execution speed and coordination determine the 'splash' effect.",
    guiding_questions: [
      "Is the 'War Room' set up?",
      "Are we monitoring for bugs?",
      "Is the press release live?",
      "Are we engaging with reactions?"
    ],
    expected_output: "Successful Go-Live across all channels."
  },
  "Monitor, Measure, and Optimize": {
    description: "Track performance in real-time. Fix bugs, answer questions, and measure against KPIs.",
    why_matters: "Launch isn't the end; it's the beginning. Quick reaction to issues preserves reputation.",
    guiding_questions: [
      "Are we hitting our targets?",
      "What is the sentiment?",
      "Are there broken links?",
      "How is the team handling the volume?"
    ],
    expected_output: "Launch Performance Report and Issue Resolution Log."
  },
  "Celebrate Success and Sustain Momentum": {
    description: "Recognize the team's hard work. Transition from 'Launch Mode' to 'Sustain Mode'.",
    why_matters: "Prevents burnout and reinforces the importance of the project. Keeps energy high for the long haul.",
    guiding_questions: [
      "How are we celebrating?",
      "What is the plan for Week 2?",
      "How do we keep the brand top-of-mind?",
      "Have we shared success stories?"
    ],
    expected_output: "Post-Mortem/Celebration and Phase 2 Roadmap."
  },

  // --- PHASE 7: OPERATIONS ---
  "Establish Brand Governance Structure": {
    description: "Create formal systems to maintain consistency. Define the 'Brand Team' and decision-making frameworks.",
    why_matters: "Without governance, entropy sets in. This ensures the brand stays consistent as it scales.",
    guiding_questions: [
      "Centralized or Distributed model?",
      "Who has final authority?",
      "What is the approval workflow?",
      "How do we handle non-compliance?"
    ],
    expected_output: "Governance Framework and Compliance Monitoring Process."
  },
  "Maintain and Update Brand Guidelines": {
    description: "Keep the guidelines document living and relevant. Schedule reviews and updates.",
    why_matters: "Markets change. Static guidelines become obsolete. Regular updates ensure relevance.",
    guiding_questions: [
      "How often do we review?",
      "What is the process for changes?",
      "Are new channels covered?",
      "Is the document accessible?"
    ],
    expected_output: "Guideline Maintenance Schedule."
  },
  "Manage Brand Asset Library": {
    description: "Ongoing curation of the DAM. Tagging, organizing, archiving old files.",
    why_matters: "A messy library leads to using old logos. A clean library enables self-service.",
    guiding_questions: [
      "Are we archiving old versions?",
      "Are new assets tagged correctly?",
      "Are licenses tracked?",
      "Is the library integrated?"
    ],
    expected_output: "Maintained and Curated Asset Library."
  },
  "Provide Ongoing Training and Support": {
    description: "Onboarding new hires, holding workshops, and answering questions.",
    why_matters: "New employees need to learn the brand. Existing employees need refreshers.",
    guiding_questions: [
      "Is brand training in onboarding?",
      "Do we hold workshops?",
      "Is there a help channel?",
      "Are there Brand Champions?"
    ],
    expected_output: "Training Program and Support Channels."
  },
  "Measure Brand Performance": {
    description: "Track Awareness, Perception, and Consistency over time.",
    why_matters: "Proves the value of the brand to the business. Justifies budget.",
    guiding_questions: [
      "Is awareness growing?",
      "Is sentiment positive?",
      "Are employees compliant?",
      "What is the ROI?"
    ],
    expected_output: "Quarterly Brand Performance Report."
  },
  "Evolve Brand as Business Grows": {
    description: "Monitor market changes and adapt. Plan for incremental evolution vs rebrand.",
    why_matters: "Ensures the brand doesn't stagnate. Aligns brand with business strategy shifts.",
    guiding_questions: [
      "Has our target changed?",
      "Are competitors moving?",
      "Do we need a refresh?",
      "Is our architecture working?"
    ],
    expected_output: "Brand Evolution Roadmap."
  },
  "Build Brand Culture": {
    description: "Embed brand into values, rituals, and employee behavior.",
    why_matters: "A brand is lived from the inside out. Strong culture equals strong external brand.",
    guiding_questions: [
      "Do hiring practices align?",
      "Are we celebrating the brand?",
      "Do leaders model it?",
      "Is there internal pride?"
    ],
    expected_output: "Brand Culture Initiatives and Rituals."
  },

  // --- PHASE 8: GROWTH ---
  "Develop Brand-Driven Growth Strategy": {
    description: "Create a strategic plan to leverage the brand for business growth (awareness, premium pricing, retention).",
    why_matters: "Brand should be a growth engine, not just a cost center. Shifts focus to ROI.",
    guiding_questions: [
      "How can brand drive lower CAC?",
      "Can we command a price premium?",
      "What new markets can we enter?",
      "How do we increase LTV?"
    ],
    expected_output: "Brand Growth Strategy and Quarterly Plans."
  },
  "Optimize Brand Performance": {
    description: "A/B testing, CRO, and channel optimization to improve effectiveness.",
    why_matters: "Data-driven refinement increases efficiency and results.",
    guiding_questions: [
      "What messaging performs best?",
      "Which channels drive engagement?",
      "Is the website converting?",
      "Are we testing creative?"
    ],
    expected_output: "Optimization Program and Test Results."
  },
  "Expand Brand Reach and Presence": {
    description: "Enter new markets, launch new channels, and build partnerships.",
    why_matters: "Growth requires reaching new audiences. Diversification reduces risk.",
    guiding_questions: [
      "What is the next market?",
      "Should we launch a new channel?",
      "What partnerships fit?",
      "How do we build community?"
    ],
    expected_output: "Expansion Strategy for Markets/Channels."
  },
  "Leverage Brand for Competitive Advantage": {
    description: "Conduct competitive analysis, differentiate, and capture market share.",
    why_matters: "Winning requires understanding the battlefield and using your unique strengths.",
    guiding_questions: [
      "Where are competitors weak?",
      "What is our 'unfair advantage'?",
      "How do we defend market share?",
      "Can we disrupt the category?"
    ],
    expected_output: "Competitive Strategy and Differentiation Plan."
  },
  "Maximize Brand Asset Value": {
    description: "Explore extensions, sub-brands, licensing, and IP protection.",
    why_matters: "Monetizing brand equity creates new revenue streams and asset value.",
    guiding_questions: [
      "Can we extend categories?",
      "Do we need a sub-brand?",
      "Is IP protected?",
      "Are there licensing opportunities?"
    ],
    expected_output: "Brand Asset Value Strategy (Extensions/IP)."
  },
  "Innovate and Stay Ahead": {
    description: "Monitor trends, experiment with new tech/tactics, and stay fresh.",
    why_matters: "Adaptability is survival. Innovation keeps the brand relevant to future generations.",
    guiding_questions: [
      "What emerging tech affects us?",
      "Are behaviors shifting?",
      "How do we foster innovation?",
      "What is the next 'big thing'?"
    ],
    expected_output: "Innovation Program and Trend Monitoring."
  }
};
