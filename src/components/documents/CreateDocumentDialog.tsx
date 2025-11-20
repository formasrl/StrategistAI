import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
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

interface CreateDocumentDialogProps {
  projectId: string;
  stepId: string;
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: () => void;
}

const formSchema = z.object({
  document_name: z.string().min(2, { message: 'Document name must be at least 2 characters.' }),
});

const CreateDocumentDialog: React.FC<CreateDocumentDialogProps> = ({
  projectId,
  stepId,
  isOpen,
  onClose,
  onDocumentCreated,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      document_name: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { data, error } = await supabase.from('documents').insert({
      project_id: projectId,
      step_id: stepId,
      document_name: values.document_name,
      status: 'draft',
      current_version: 1,
      content: '', // Initialize with empty content
    }).select().single();

    if (error) {
      showError(`Failed to create document: ${error.message}`);
    } else {
      // Toast removed
      form.reset();
      onDocumentCreated();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Add a new document for this step.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="document_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Brand Strategy Brief" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Document</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDocumentDialog;