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
import { Button } from '@/components/ui/button';

interface CreatePhaseDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onPhaseCreated: () => void;
}

const formSchema = z.object({
  phase_name: z.string().min(2, { message: 'Phase name must be at least 2 characters.' }),
});

const CreatePhaseDialog: React.FC<CreatePhaseDialogProps> = ({
  projectId,
  isOpen,
  onClose,
  onPhaseCreated,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phase_name: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Determine the next phase number
    const { data: existingPhases, error: fetchError } = await supabase
      .from('phases')
      .select('phase_number')
      .eq('project_id', projectId)
      .order('phase_number', { ascending: false })
      .limit(1);

    if (fetchError) {
      showError(`Failed to fetch existing phases: ${fetchError.message}`);
      return;
    }

    const nextPhaseNumber = existingPhases && existingPhases.length > 0
      ? existingPhases[0].phase_number + 1
      : 1;

    const { error } = await supabase.from('phases').insert({
      project_id: projectId,
      phase_name: values.phase_name,
      phase_number: nextPhaseNumber,
      status: 'not_started',
      completion_percentage: 0,
    });

    if (error) {
      showError(`Failed to create phase: ${error.message}`);
    } else {
      showSuccess('Phase created successfully!');
      form.reset();
      onPhaseCreated();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Phase</DialogTitle>
          <DialogDescription>
            Add a new phase to your project roadmap.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phase_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phase Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Discovery & Research" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Phase</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePhaseDialog;