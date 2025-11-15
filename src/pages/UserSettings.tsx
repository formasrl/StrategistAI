import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { UserSettings as UserSettingsType } from '@/types/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
  openai_api_key: z.string().optional(),
  preferred_model: z.string().optional(),
  ai_enabled: z.boolean().default(true),
});

const UserSettings: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      openai_api_key: '',
      preferred_model: 'gpt-4o', // Default model
      ai_enabled: true,
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setIsLoadingSettings(false);
        return;
      }

      setIsLoadingSettings(true);
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        showError(`Failed to load settings: ${error.message}`);
      } else if (data) {
        form.reset({
          openai_api_key: data.openai_api_key || '',
          preferred_model: data.preferred_model || 'gpt-4o',
          ai_enabled: data.ai_enabled ?? true,
        });
      }
      setIsLoadingSettings(false);
    };

    if (!isSessionLoading) {
      fetchSettings();
    }
  }, [user, isSessionLoading, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('You must be logged in to save settings.');
      return;
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          openai_api_key: values.openai_api_key || null,
          preferred_model: values.preferred_model || null,
          ai_enabled: values.ai_enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      showError(`Failed to save settings: ${error.message}`);
    } else {
      showSuccess('Settings saved successfully!');
    }
  };

  if (isSessionLoading || isLoadingSettings) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">AI Settings</CardTitle>
        <CardDescription>Manage your preferences for AI assistance.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="ai_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable AI Features</FormLabel>
                    <FormDescription>
                      Toggle AI assistance on or off for your projects.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="openai_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OpenAI API Key (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide your OpenAI API key to enable advanced AI features. This is stored securely.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferred_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred AI Model</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a preferred AI model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose the OpenAI model you'd like to use for AI assistance.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Save Settings</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default UserSettings;