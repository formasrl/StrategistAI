import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showSuccess, showError } from '@/utils/toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Project name must be at least 2 characters.',
  }),
  business_type: z.string().optional(),
  timeline: z.string().optional(),
});

const ProjectCreation = () => {
  const { user, isLoading } = useSession();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*');
      
      if (error) {
        console.error("Error fetching templates:", error);
      } else {
        setTemplates(data || []);
      }
    };
    fetchTemplates();
  }, []);

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
      navigate('/login');
      return;
    }

    if (templates.length === 0) {
      showError('No project templates available. Please contact support.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: values.name,
          business_type: values.business_type,
          timeline: values.timeline,
        })
        .select()
        .single();

      if (projectError) {
        showError(`Failed to create project: ${projectError.message}`);
        return;
      }

      const newProjectId = projectData.id;
      const templateStructure = templates[0].structure; // Use the first template for now

      // 2. Seed phases and steps from template
      for (const initialPhase of templateStructure) {
        const { data: phaseData, error: phaseError } = await supabase
          .from('phases')
          .insert({
            project_id: newProjectId,
            phase_name: initialPhase.phase_name,
            phase_number: initialPhase.phase_number,
            description: initialPhase.description,
            status: 'not_started',
            completion_percentage: 0,
          })
          .select()
          .single();

        if (phaseError) {
          showError(`Failed to create phase "${initialPhase.phase_name}": ${phaseError.message}`);
          return;
        }

        const newPhaseId = phaseData.id;

        for (const initialStep of initialPhase.steps) {
          const { error: stepError } = await supabase
            .from('steps')
            .insert({
              phase_id: newPhaseId,
              step_name: initialStep.step_name,
              step_number: initialStep.step_number,
              description: initialStep.description,
              why_matters: initialStep.why_matters,
              dependencies: initialStep.dependencies,
              timeline: initialStep.timeline,
              order_index: initialStep.order_index,
              status: 'not_started',
            });

          if (stepError) {
            showError(`Failed to create step "${initialStep.step_name}": ${stepError.message}`);
            return;
          }
        }
      }

      showSuccess('Project and roadmap created successfully!');
      navigate(`/dashboard/${newProjectId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Create New Project</CardTitle>
          <CardDescription className="text-center">
            Tell us a bit about your new brand development project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., My Awesome Brand" {...field} />
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
                    <FormLabel>Project Timeline (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., 3 months, ongoing, launch by Q4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Project...</>
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

export default ProjectCreation;