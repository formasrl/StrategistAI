import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Project } from '@/types/supabase';
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

interface EditProjectDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
}

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Project name must be at least 2 characters.',
  }),
  business_type: z.string().optional(),
  timeline: z.string().optional(),
});

const EditProjectDialog: React.FC<EditProjectDialogProps> = ({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project.name,
      business_type: project.business_type || '',
      timeline: project.timeline || '',
    },
  });

  // Reset form with current project data when dialog opens or project changes
  useEffect(() => {
    if (isOpen && project) {
      form.reset({
        name: project.name,
        business_type: project.business_type || '',
        timeline: project.timeline || '',
      });
    }
  }, [isOpen, project, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { error } = await supabase
      .from('projects')
      .update({
        name: values.name,
        business_type: values.business_type || null,
        timeline: values.timeline || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (error) {
      showError(`Failed to update project: ${error.message}`);
    } else {
      showSuccess('Project updated successfully!');
      onProjectUpdated();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Make changes to your project details here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;