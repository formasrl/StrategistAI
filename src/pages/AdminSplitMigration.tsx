import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, CheckCircle2, XCircle } from 'lucide-react';
import { TemplatePhase, TemplateStep } from '@/types/supabase'; // Import new types

const AdminSplitMigration: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogMessages((prev) => [...prev, `[${type.toUpperCase()}] ${message}`]);
  };

  const runMigration = async () => {
    setIsLoading(true);
    setLogMessages([]);
    addLog('Starting migration process...');

    try {
      // 1. Fetch the 'Standard Brand Strategy' template
      addLog('Fetching "Standard Brand Strategy" template...');
      const { data: templateData, error: templateError } = await supabase
        .from('project_templates')
        .select('*')
        .eq('name', 'Standard Brand Strategy')
        .single();

      if (templateError || !templateData) {
        throw new Error(`Template not found: ${templateError?.message || 'Unknown error'}`);
      }
      addLog(`Template "${templateData.name}" fetched successfully. ID: ${templateData.id}`);

      // 2. Cast the structure column to an array of Phases
      const roadmapStructure: TemplatePhase[] = templateData.structure as TemplatePhase[];
      addLog(`Found ${roadmapStructure.length} phases in the template structure.`);

      // 3. Delete any existing records in the template_phases table for this template_id
      addLog(`Deleting existing template phases for template ID ${templateData.id}...`);
      const { error: deletePhasesError } = await supabase
        .from('template_phases')
        .delete()
        .eq('template_id', templateData.id);

      if (deletePhasesError) {
        throw new Error(`Failed to delete existing template phases: ${deletePhasesError.message}`);
      }
      addLog('Existing template phases deleted.');

      // 4. Loop through each Phase in the JSON and insert it into the template_phases table.
      for (const phase of roadmapStructure) {
        addLog(`Processing phase: ${phase.phase_name}`);
        const { data: newPhase, error: insertPhaseError } = await supabase
          .from('template_phases')
          .insert({
            template_id: templateData.id,
            phase_name: phase.phase_name,
            phase_number: phase.phase_number,
            description: phase.description,
          })
          .select('id')
          .single();

        if (insertPhaseError || !newPhase) {
          throw new Error(`Failed to insert phase "${phase.phase_name}": ${insertPhaseError?.message || 'No ID returned'}`);
        }
        addLog(`Phase "${phase.phase_name}" inserted with new ID: ${newPhase.id}`);

        // 5. Then, loop through that Phase's steps and insert them into the template_steps table
        for (const step of phase.steps || []) { // Ensure steps array exists
          addLog(`  Processing step: ${step.step_name}`);
          const { error: insertStepError } = await supabase
            .from('template_steps')
            .insert({
              phase_id: newPhase.id,
              step_name: step.step_name,
              step_number: step.step_number,
              description: step.description,
              why_matters: step.why_matters,
              timeline: step.timeline,
              order_index: step.order_index,
              dependencies: step.dependencies ? JSON.stringify(step.dependencies) : '[]',
              guiding_questions: step.guiding_questions ? JSON.stringify(step.guiding_questions) : '[]',
              expected_output: step.expected_output,
            });

          if (insertStepError) {
            throw new Error(`Failed to insert step "${step.step_name}": ${insertStepError.message}`);
          }
          addLog(`  Step "${step.step_name}" inserted.`);
        }
      }

      addLog('Migration completed successfully!', 'success');
      toast({
        title: "Migration Successful",
        description: "Template data has been successfully migrated to new tables.",
        action: <CheckCircle2 className="text-green-500" />,
      });

    } catch (error: any) {
      addLog(`Migration failed: ${error.message}`, 'error');
      console.error('Migration Error:', error);
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error.message || "An unknown error occurred during migration.",
        action: <XCircle className="text-red-500" />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> Admin Template Split Migration
          </CardTitle>
          <CardDescription>
            This tool migrates the 'Standard Brand Strategy' template from its single JSON column
            into the new `template_phases` and `template_steps` tables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={runMigration}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Migration...
              </>
            ) : (
              'Run Migration'
            )}
          </Button>

          <div className="border rounded-md bg-muted p-4 h-64 overflow-y-auto text-sm font-mono">
            <p className="font-semibold mb-2">Migration Log:</p>
            {logMessages.length === 0 ? (
              <p className="text-muted-foreground italic">Click "Run Migration" to start.</p>
            ) : (
              logMessages.map((msg, index) => (
                <p key={index} className={
                  msg.includes('[ERROR]') ? 'text-red-500' :
                  msg.includes('[SUCCESS]') ? 'text-green-500' :
                  'text-foreground'
                }>
                  {msg}
                </p>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSplitMigration;