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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCcw, AlertTriangle, Database, Edit, Save } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Step } from '@/types/supabase';

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

  // Guidance Editor State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);

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

  // --- SETTINGS LOGIC ---
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
    if (!user) return;
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

  // --- GUIDANCE EDITOR LOGIC ---
  useEffect(() => {
    const fetchProjects = async () => {
      if(!user) return;
      const { data } = await supabase.from('projects').select('id, name').eq('user_id', user.id);
      if (data) setProjects(data);
    };
    fetchProjects();
  }, [user]);

  useEffect(() => {
    const fetchSteps = async () => {
      if (!selectedProjectId) {
        setSteps([]);
        return;
      }
      // Join with phases to get phase name/number for grouping
      const { data, error } = await supabase
        .from('steps')
        .select('*, phases(phase_number, phase_name)')
        .eq('phases.project_id', selectedProjectId)
        .order('phase_number', { foreignTable: 'phases', ascending: true })
        .order('order_index', { ascending: true });

      if (error) {
        console.error("Error fetching steps", error);
      } else {
        // Filter out any steps where the join failed (shouldn't happen, but good safety)
        const validSteps = data?.filter(s => s.phases) || [];
        // We need to sort manually because cross-table sorting can be tricky in simple select if structure is complex
        // But Supabase usually handles it. Let's double check sort order.
        // The returned data is flat steps with a nested phase object.
        // We'll sort client side to be safe:
        validSteps.sort((a, b) => {
           if (a.phases.phase_number !== b.phases.phase_number) {
             return a.phases.phase_number - b.phases.phase_number;
           }
           return (a.order_index || 0) - (b.order_index || 0);
        });
        setSteps(validSteps as unknown as Step[]);
      }
    };
    fetchSteps();
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedStepId) {
      const step = steps.find(s => s.id === selectedStepId);
      setEditingStep(step || null);
    } else {
      setEditingStep(null);
    }
  }, [selectedStepId, steps]);

  const handleSaveStep = async () => {
    if (!editingStep) return;
    setIsSavingStep(true);

    // Guiding questions needs to be JSON array for DB
    // The textarea will likely contain newlines.
    let questionsToSave = editingStep.guiding_questions;
    
    // If guiding_questions is a string in local state (from textarea), convert to array
    if (typeof editingStep.guiding_questions === 'string') {
        questionsToSave = (editingStep.guiding_questions as string).split('\n').filter(q => q.trim() !== '');
    }

    const { error } = await supabase
      .from('steps')
      .update({
        description: editingStep.description,
        why_matters: editingStep.why_matters,
        expected_output: editingStep.expected_output,
        guiding_questions: questionsToSave as any // Cast for JSONB
      })
      .eq('id', editingStep.id);

    if (error) {
      showError(`Failed to update step: ${error.message}`);
    } else {
      showSuccess('Step guidance updated successfully!');
      // Refresh list
      const updatedSteps = steps.map(s => s.id === editingStep.id ? { ...s, ...editingStep, guiding_questions: questionsToSave } : s);
      setSteps(updatedSteps as any);
    }
    setIsSavingStep(false);
  };

  if (isSessionLoading || isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <p className="text-xl">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      
      {/* USER SETTINGS */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">User Settings</CardTitle>
          <CardDescription>Manage your preferences for AI assistance and application display.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="ai_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable AI Features</FormLabel>
                          <FormDescription>
                            Toggle AI assistance on or off.
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
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme</FormLabel>
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
              </div>

              <FormField
                control={form.control}
                name="openai_api_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAI API Key (Optional)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="sk-..." {...field} />
                    </FormControl>
                    <FormDescription>Stored securely for AI features.</FormDescription>
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
                      <Button type="button" variant="ghost" size="sm" onClick={() => fetchOpenAIModels(openaiApiKey || '')} disabled={isLoadingModels || !openaiApiKey}>
                         {isLoadingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Refresh
                      </Button>
                    </div>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingModels || !openaiApiKey}>
                      <FormControl>
                        <SelectTrigger>
                           <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableModels.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                        {!openaiApiKey && <SelectItem value="gpt-4o-mini">GPT-4o-mini (Default)</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end">
                 <Button type="submit">Save Settings</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* GUIDANCE EDITOR */}
      <Card className="w-full border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10">
        <CardHeader>
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Edit className="h-5 w-5" /> Project Roadmap Manager
                    </CardTitle>
                    <CardDescription>
                        Manually edit step definitions for a specific project. Changes are saved directly to the database.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Select Project & Step */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Project</label>
                    <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                        <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Choose a project to edit..." />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Select Step to Edit</label>
                    <Select onValueChange={setSelectedStepId} value={selectedStepId} disabled={!selectedProjectId}>
                        <SelectTrigger className="bg-background">
                             <SelectValue placeholder={!selectedProjectId ? "Select a project first" : "Choose a step..."} />
                        </SelectTrigger>
                        <SelectContent>
                           {steps.map(s => (
                               <SelectItem key={s.id} value={s.id}>
                                   {(s as any).phases ? `Phase ${(s as any).phases.phase_number}: ` : ''} {s.step_name}
                               </SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {editingStep && (
                <div className="space-y-4 border-t border-border pt-6 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Step Name</label>
                        <Input value={editingStep.step_name} disabled className="bg-muted text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Step names are locked to maintain structure integrity.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description (Goal)</label>
                        <Textarea 
                            value={editingStep.description || ''} 
                            onChange={(e) => setEditingStep({...editingStep, description: e.target.value})}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Why it Matters</label>
                        <Textarea 
                            value={editingStep.why_matters || ''} 
                            onChange={(e) => setEditingStep({...editingStep, why_matters: e.target.value})}
                            rows={2}
                        />
                    </div>

                     <div className="space-y-2">
                        <label className="text-sm font-medium">Expected Output</label>
                        <Input 
                            value={editingStep.expected_output || ''} 
                            onChange={(e) => setEditingStep({...editingStep, expected_output: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Guiding Questions (One per line)</label>
                        <Textarea 
                            value={Array.isArray(editingStep.guiding_questions) 
                                ? editingStep.guiding_questions.join('\n') 
                                : (editingStep.guiding_questions || '')}
                            onChange={(e) => setEditingStep({...editingStep, guiding_questions: e.target.value as any})} // Cast for local state handling
                            rows={5}
                            placeholder="Enter questions, one per line..."
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveStep} disabled={isSavingStep} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSavingStep ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes to Database
                        </Button>
                    </div>
                </div>
            )}
            {!editingStep && selectedProjectId && (
                <div className="text-center py-8 text-muted-foreground italic">
                    Select a step above to begin editing its guidance content.
                </div>
            )}
        </CardContent>
      </Card>

      {/* ADMIN ACTIONS */}
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
            Go to Bulk Migration Tool
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSettings;