import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Phase } from '@/types/supabase';
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

interface EditPhaseDialogProps {
  phase: Phase;
  isOpen: boolean;
  onClose: () => void;
  onPhaseUpdated: () => void;
}

const formSchema = z.object({
  phase_name: z.string().min(2, { message: 'Phase name must be at least 2 characters.' }),
  description: z.string().optional(),
});

const EditPhaseDialog: React.FC<EditPhaseDialogProps> = ({
  phase,
  isOpen,
  onClose,
  onPhaseUpdated,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phase_name: phase.phase_name,
      description: phase.description || '',
    },
  });

  // Reset form values when the phase prop changes (e.g., dialog opens for a different phase)
  useEffect(() => {
    if (phase) {
      form.reset({
        phase_name: phase.phase_name,
        description: phase.description || '',
      });
    }
  }, [phase, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { error } = await supabase
      .from('phases')
      .update({
        phase_name: values.phase_name,
        description: values.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', phase.id);

    if (error) {
      showError(`Failed to update phase: ${error.message}`);
    } else {
      showSuccess('Phase updated successfully!');
      onPhaseUpdated();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Phase {phase.phase_number}: {phase.phase_name}</DialogTitle>
          <DialogDescription>
            Make changes to this phase. Click save when you're done.
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Briefly describe this phase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPhaseDialog;