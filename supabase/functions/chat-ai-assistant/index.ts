import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, documentId, projectId, phaseId, stepId } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Fetch user settings
    const { data: userSettings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('openai_api_key, preferred_model, ai_enabled')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching user settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch user settings.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!userSettings || !userSettings.ai_enabled) {
      return new Response(JSON.stringify({ error: 'AI features are disabled or settings not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const openaiApiKey = userSettings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    const preferredModel = userSettings.preferred_model || 'gpt-4o';

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Please set it in your AI Settings or as a Supabase secret.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let context = '';
    if (documentId) {
      const { data: document, error: documentError } = await supabaseClient
        .from('documents')
        .select('content, document_name')
        .eq('id', documentId)
        .single();
      if (documentError) console.error('Error fetching document for chat context:', documentError);
      if (document) {
        context += `Current Document: ${document.document_name}\nContent:\n${document.content}\n\n`;
      }
    } else if (stepId) {
      const { data: step, error: stepError } = await supabaseClient
        .from('steps')
        .select('step_name, description, why_matters, timeline, dependencies')
        .eq('id', stepId)
        .single();
      if (stepError) console.error('Error fetching step for chat context:', stepError);
      if (step) {
        context += `Current Step: ${step.step_name}\nDescription: ${step.description}\nWhy it matters: ${step.why_matters}\nTimeline: ${step.timeline}\nDependencies: ${step.dependencies?.join(', ')}\n\n`;
      }
    } else if (phaseId) {
      const { data: phase, error: phaseError } = await supabaseClient
        .from('phases')
        .select('phase_name, description')
        .eq('id', phaseId)
        .single();
      if (phaseError) console.error('Error fetching phase for chat context:', phaseError);
      if (phase) {
        context += `Current Phase: ${phase.phase_name}\nDescription: ${phase.description}\n\n`;
      }
    } else if (projectId) {
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .select('name, business_type, timeline')
        .eq('id', projectId)
        .single();
      if (projectError) console.error('Error fetching project for chat context:', projectError);
      if (project) {
        context += `Current Project: ${project.name}\nBusiness Type: ${project.business_type}\nTimeline: ${project.timeline}\n\n`;
      }
    }

    const systemPrompt = `You are an expert brand strategist and helpful AI assistant. Your goal is to guide the user through a brand development roadmap. Provide concise, actionable advice and answer questions based on the provided context. If no specific context is given, provide general brand strategy advice. Keep your responses professional and encouraging.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${context}User's question: ${message}` },
    ];

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: preferredModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error('OpenAI API error:', errorData);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${errorData.error?.message || openaiResponse.statusText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: openaiResponse.status,
      });
    }

    const openaiData = await openaiResponse.json();
    const aiResponseContent = openaiData.choices[0].message.content;

    return new Response(JSON.stringify({ response: aiResponseContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});