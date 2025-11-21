import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCcw, AlertTriangle, Database } from 'lucide-react';
import { useTheme } from 'next-themes';

const formSchema = z.object({
  openai_api_key: z.string().optional(),
  preferred_model: z.string().optional(),
  ai_enabled: z.boolean().default(true),
  theme: z.enum(['light', 'dark']).default('light'),
  timezone: z.string().default('UTC'),
});

const UserSettings: React.FC = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [hasFetchedInitialModels, setHasFetchedInitialModels] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      openai_api_key: '',
      preferred_model: 'gpt-4o-mini',
      ai_enabled: true,
      theme: 'light',
      timezone: 'UTC',
    },
  });

  const openaiApiKey = form.watch('openai_api_key');

  const fetchOpenAIModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setAvailableModels([]);
      showError('Please provide an OpenAI API key to fetch models.');
      return;
    }

    setIsLoadingModels(true);
    setAvailableModels([]);
    setHasFetchedInitialModels(true);

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch OpenAI models.');
      }

      const data = await response.json();
      const chatModels = data.data
        .filter((model: any) => model.id.startsWith('gpt-') || model.id.startsWith('ft:gpt-'))
        .map((model: any) => model.id)
        .sort();

      setAvailableModels(chatModels);
      if (form.getValues('preferred_model') && !chatModels.includes(form.getValues('preferred_model'))) {
        form.setValue('preferred_model', chatModels.length > 0 ? chatModels[0] : 'gpt-4o-mini');
      } else if (!form.getValues('preferred_model') && chatModels.length > 0) {
        form.setValue('preferred_model', chatModels[0]);
      }
      showSuccess('OpenAI models updated successfully!');
    } catch (error: any) {
      showError(`Error fetching OpenAI models: ${error.message}`);
      setAvailableModels([]);
      form.setValue('preferred_model', 'gpt-4o-mini');
    } finally {
      setIsLoadingModels(false);
    }
  }, [form]);

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
        .maybeSingle();

      if (error) {
        showError(`Failed to load settings: ${error.message}`);
      } else if (data) {
        form.reset({
          openai_api_key: data.openai_api_key || '',
          preferred_model: data.preferred_model || 'gpt-4o-mini',
          ai_enabled: data.ai_enabled ?? true,
          theme: (data.theme as 'light' | 'dark') || 'light',
          timezone: data.timezone || 'UTC',
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
          theme: values.theme,
          timezone: values.timezone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      showError(`Failed to save settings: ${error.message}`);
    } else {
      showSuccess('Settings saved successfully!');
      setTheme(values.theme);
      if (values.openai_api_key && values.openai_api_key !== openaiApiKey && !hasFetchedInitialModels) {
        fetchOpenAIModels(values.openai_api_key);
      }
    }
  };

  if (isSessionLoading || isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">User Settings</CardTitle>
          <CardDescription>Manage your preferences for AI assistance and application display.</CardDescription>
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Preferred AI Model</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchOpenAIModels(openaiApiKey || '')}
                        disabled={isLoadingModels || !openaiApiKey}
                      >
                        {isLoadingModels ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        Update Models
                      </Button>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingModels || !openaiApiKey}>
                      <FormControl>
                        <SelectTrigger>
                          {isLoadingModels ? (
                            <span className="flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading models...
                            </span>
                          ) : (
                            <SelectValue placeholder="Select a preferred AI model" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!availableModels.includes(field.value || '') && field.value && (
                           <SelectItem value={field.value} className="italic">
                             {field.value} (Current)
                           </SelectItem>
                        )}
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))
                        ) : (
                          !openaiApiKey && !hasFetchedInitialModels && (
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o-mini (Default)
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the OpenAI model you'd like to use for AI assistance.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Application Theme</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                        <SelectItem value="Europe/London">Europe/London</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                        <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit">Save Settings</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="w-full border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-500">
            <Database className="h-5 w-5" /> Admin Actions
          </CardTitle>
          <CardDescription>
            Advanced actions for system maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full justify-start text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={() => navigate('/admin/migration')}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Run Content Migration Tool
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSettings;