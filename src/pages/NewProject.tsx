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
import { initialRoadmapData } from '@/utils/initialRoadmapData';
import { Loader2 } from 'lucide-react';

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
      // 1. Insert the new project
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

      // 2. Insert phases and their steps
      for (const initialPhase of initialRoadmapData) {
        const { data: phaseData, error: phaseError } = await supabase
          .from('phases')
          .insert({
            project_id: newProjectId,
            phase_number: initialPhase.phase_number,
            phase_name: initialPhase.phase_name,
            description: initialPhase.description,
            status: 'not_started', // Default status
            completion_percentage: 0,
          })
          .select()
          .single();

        if (phaseError) throw phaseError;

        const newPhaseId = phaseData.id;

        // Insert steps for the current phase
        const stepsToInsert = initialPhase.steps.map((initialStep) => ({
          phase_id: newPhaseId,
          step_number: initialStep.step_number,
          step_name: initialStep.step_name,
          description: initialStep.description || null,
          why_matters: initialStep.why_matters || null,
          dependencies: initialStep.dependencies || [],
          status: 'not_started', // Default status for steps
          timeline: initialStep.timeline || null,
          order_index: initialStep.order_index,
          guiding_questions: initialStep.guiding_questions || null,
          expected_output: initialStep.expected_output || null,
        }));

        const { error: stepsError } = await supabase
          .from('steps')
          .insert(stepsToInsert);

        if (stepsError) throw stepsError;
      }

      showSuccess('Project created successfully!');
      navigate(`/project/${newProjectId}`);
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