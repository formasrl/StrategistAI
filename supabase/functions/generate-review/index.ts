import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentId, projectId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch Document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*, steps(*)')
      .eq('id', documentId)
      .single();

    if (docError || !document) throw new Error('Document not found');

    // 2. Fetch Project Context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId || document.project_id)
      .single();

    // 3. Prepare Context
    const step = document.steps;
    
    const systemPrompt = `
You are an expert business consultant and editor reviewing a document for a startup.
Your goal is to provide constructive feedback, catch marketing inconsistencies, and ensure clarity.

Project Context:
- Name: ${project?.name}
- One Liner: ${project?.one_liner}
- Audience: ${project?.audience}
- Business Type: ${project?.business_type}
- Project Profile: ${project?.project_profile}

Step Context:
- Step Name: ${step?.step_name}
- Description: ${step?.description}
- Goal: ${step?.why_matters}

Analyze the provided document content.
Return a JSON response with the following keys:
- summary: A brief summary of the document.
- strengths: Array of strings (what is good).
- suggestions: Array of strings (actionable improvements).
- issues: Array of strings (critical problems).
- consistency_issues: Array of strings (conflicts with project goals/tone).
- readiness: "draft", "review_needed", or "ready".
- readiness_reason: Short explanation of the status.
`;

    const userPrompt = `
Document Name: ${document.document_name}
Content:
${document.content || "(Empty document)"}
`;

    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const reviewData = JSON.parse(content);

    // Save review to DB
    const { error: saveError } = await supabase
      .from('ai_reviews')
      .upsert({
        document_id: documentId,
        ...reviewData,
        review_timestamp: new Date().toISOString()
      });

    if (saveError) throw saveError;

    return new Response(JSON.stringify(reviewData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});