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
import { TemplatePhase, TemplateStep } from '@/types/supabase'; // Import new types

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
      // 1. Fetch the "Standard Brand Strategy" template to get its ID
      const { data: projectTemplate, error: templateError } = await supabase
        .from('project_templates')
        .select('id')
        .eq('name', 'Standard Brand Strategy')
        .single();

      if (templateError || !projectTemplate) {
        throw new Error('Standard project template not found. Please contact support or run migration.');
      }

      // 2. Fetch template phases and their nested steps using the template_id
      const { data: templatePhasesData, error: templatePhasesError } = await supabase
        .from('template_phases')
        .select('*, template_steps(*)') // Select phases and their nested steps
        .eq('template_id', projectTemplate.id)
        .order('phase_number', { ascending: true })
        .order('order_index', { foreignTable: 'template_steps', ascending: true });

      if (templatePhasesError || !templatePhasesData || templatePhasesData.length === 0) {
        throw new Error('No template phases found for the standard template. Please ensure migration has been run.');
      }

      // 3. Insert the new project
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

      // 4. Loop through the fetched TemplatePhases and insert them into the 'phases' table
      for (const templatePhase of templatePhasesData) {
        const { data: newPhase, error: insertPhaseError } = await supabase
          .from('phases')
          .insert({
            project_id: newProjectId,
            phase_number: templatePhase.phase_number,
            phase_name: templatePhase.phase_name,
            description: templatePhase.description,
            status: 'not_started',
            completion_percentage: 0,
          })
          .select('id')
          .single();

        if (insertPhaseError) throw insertPhaseError;

        const newPhaseId = newPhase.id;

        // 5. Loop through the TemplateSteps associated with the current TemplatePhase
        //    and insert them into the 'steps' table
        const stepsToInsert = (templatePhase.template_steps || []).map((templateStep: TemplateStep) => ({
          phase_id: newPhaseId,
          step_number: templateStep.step_number,
          step_name: templateStep.step_name,
          description: templateStep.description || null,
          why_matters: templateStep.why_matters || null,
          dependencies: templateStep.dependencies ? JSON.stringify(templateStep.dependencies) : '[]',
          status: 'not_started',
          timeline: templateStep.timeline || null,
          order_index: templateStep.order_index,
          guiding_questions: templateStep.guiding_questions ? JSON.stringify(templateStep.guiding_questions) : '[]',
          expected_output: templateStep.expected_output || null,
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