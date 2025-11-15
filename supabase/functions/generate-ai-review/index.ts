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
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create a Supabase client with the user's JWT for RLS
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

    if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 means no rows found
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

    const openaiApiKey = userSettings.openai_api_key || Deno.env.get('OPENAI_API_KEY'); // Fallback to env var
    const preferredModel = userSettings.preferred_model || 'gpt-4o';

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured. Please set it in your AI Settings or as a Supabase secret.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch document content
    const { data: document, error: documentError } = await supabaseClient
      .from('documents')
      .select('content, document_name')
      .eq('id', documentId)
      .single();

    if (documentError) {
      console.error('Error fetching document:', documentError);
      return new Response(JSON.stringify({ error: 'Failed to fetch document content.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!document || !document.content) {
      return new Response(JSON.stringify({ error: 'Document not found or has no content.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: preferredModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert brand strategist and reviewer. Analyze the provided document content for a brand development project. Provide a concise review focusing on:
            - Strengths: What aspects are well-developed and effective? (Return as an array of strings)
            - Suggestions: What could be improved or added? (Return as an array of objects, each with 'title', 'description', and optional 'example' string properties)
            - Conflicts: Are there any inconsistencies or contradictions? (Return as an array of objects, each with 'issue' and optional 'resolution' string properties)
            - Alternatives: Suggest alternative approaches or ideas if applicable. (Return as an array of strings)
            Format your response as a JSON object with keys: "strengths", "suggestions", "conflicts", "alternatives".`,
          },
          {
            role: 'user',
            content: `Document Name: ${document.document_name}\n\nDocument Content:\n${document.content}`,
          },
        ],
        response_format: { type: "json_object" },
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
    const aiReviewContent = JSON.parse(openaiData.choices[0].message.content);

    // Insert AI review into the database
    const { error: insertError } = await supabaseClient.from('ai_reviews').insert({
      document_id: documentId,
      strengths: aiReviewContent.strengths,
      suggestions: aiReviewContent.suggestions,
      conflicts: aiReviewContent.conflicts,
      alternatives: aiReviewContent.alternatives,
    });

    if (insertError) {
      console.error('Error inserting AI review:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save AI review to database.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'AI review generated and saved successfully.', review: aiReviewContent }), {
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