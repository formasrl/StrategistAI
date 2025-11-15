import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface CreateStepDialogProps {
  phaseId: string;
  isOpen: boolean;
  onClose: () => void;
  onStepCreated: () => void;
}

const formSchema = z.object({
  step_name: z.string().min(2, { message: 'Step name must be at least 2 characters.' }),
  description: z.string().optional(),
  why_matters: z.string().optional(),
});

const CreateStepDialog: React.FC<CreateStepDialogProps> = ({
  phaseId,
  isOpen,
  onClose,
  onStepCreated,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      step_name: '',
      description: '',
      why_matters: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Determine the next step number
    const { data: existingSteps, error: fetchError } = await supabase
      .from('steps')
      .select('step_number')
      .eq('phase_id', phaseId)
      .order('step_number', { ascending: false })
      .limit(1);

    if (fetchError) {
      showError(`Failed to fetch existing steps: ${fetchError.message}`);
      return;
    }

    const nextStepNumber = existingSteps && existingSteps.length > 0
      ? existingSteps[0].step_number + 1
      : 1;

    const { error } = await supabase.from('steps').insert({
      phase_id: phaseId,
      step_name: values.step_name,
      step_number: nextStepNumber,
      description: values.description,
      why_matters: values.why_matters,
      status: 'not_started',
    });

    if (error) {
      showError(`Failed to create step: ${error.message}`);
    } else {
      showSuccess('Step created successfully!');
      form.reset();
      onStepCreated();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Step</DialogTitle>
          <DialogDescription>
            Add a new step to this phase.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="step_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Define Target Audience" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Briefly describe this step" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="why_matters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Why This Step Matters (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Explain the importance of this step" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Step</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStepDialog;