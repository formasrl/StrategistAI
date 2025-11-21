import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Define the structure types for the template JSON
interface TemplateStep {
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

interface TemplatePhase {
  phase_number: number;
  phase_name: string;
  description: string;
  steps: TemplateStep[];
}

const formSchema = z.object({
  name: z.string().min(1, { message: 'Project name is required.' }),
  business_type: z.string().optional(),
  timeline: z.string().optional(),
});

const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      business_type: '',
      timeline: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to create a project.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Fetch the "Standard Brand Strategy" template
      const { data: templateData, error: templateError } = await supabase
        .from('project_templates')
        .select('*')
        .eq('name', 'Standard Brand Strategy')
        .single();

      if (templateError || !templateData) {
        throw new Error('Standard project template not found. Please contact support or run migration.');
      }

      const roadmapStructure = templateData.structure as unknown as TemplatePhase[];

      // 2. Insert the new project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: values.name,
          business_type: values.business_type || null,
          timeline: values.timeline || null,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const newProjectId = projectData.id;

      // 3. Insert phases and their steps from the fetched template
      for (const phase of roadmapStructure) {
        const { data: phaseData, error: phaseError } = await supabase
          .from('phases')
          .insert({
            project_id: newProjectId,
            phase_number: phase.phase_number,
            phase_name: phase.phase_name,
            description: phase.description,
            status: 'not_started',
            completion_percentage: 0,
          })
          .select()
          .single();

        if (phaseError) throw phaseError;

        const newPhaseId = phaseData.id;

        // Map template steps to DB columns
        const stepsToInsert = phase.steps.map((step) => ({
          phase_id: newPhaseId,
          step_number: step.step_number,
          step_name: step.step_name,
          description: step.description || null,
          why_matters: step.why_matters || null,
          dependencies: step.dependencies ? JSON.stringify(step.dependencies) : '[]', // Store as JSON string if needed or let supabase handle jsonb
          status: 'not_started',
          timeline: step.timeline || null,
          order_index: step.order_index,
          // Critical: Map new content fields
          guiding_questions: step.guiding_questions ? step.guiding_questions : null, // array -> jsonb handled by supabase client usually
          expected_output: step.expected_output || null,
        }));

        const { error: stepsError } = await supabase
          .from('steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      showSuccess('Project created successfully!');
      navigate(`/dashboard/${newProjectId}`);
    } catch (error: any) {
      showError(`Failed to create project: ${error.message}`);
      console.error('Project creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Brand Strategy for Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Type (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SaaS, E-commerce, Consulting" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Timeline (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 12 weeks, 3 months" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Project...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewProject;