import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { initialRoadmapData } from '@/utils/initialRoadmapData';
import { stepGuidanceLibrary } from '@/utils/stepGuidanceData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

const AdminMigration: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('Ready.');

  // --- ORIGINAL FUNCTION: Updates Templates (Keep this for new projects) ---
  const validateAndMigrateTemplate = async () => {
    setIsLoading(true);
    setStatus('Validating template data...');

    const validationErrors: string[] = [];
    let totalSteps = 0;
    
    initialRoadmapData.forEach((phase) => {
      phase.steps.forEach((step) => {
        totalSteps++;
        if (!step.description || step.description.trim() === '') {
          validationErrors.push(`Step '${step.step_name}' is missing description.`);
        }
      });
    });

    if (validationErrors.length > 0) {
      toast({ variant: "destructive", title: "Validation Failed", description: `Found ${validationErrors.length} errors.` });
      setStatus(`Validation failed.`);
      setIsLoading(false);
      return;
    }

    setStatus(`Migrating template...`);

    try {
      const { data: existing } = await supabase
        .from('project_templates')
        .select('id')
        .eq('name', 'Standard Brand Strategy')
        .maybeSingle();

      if (existing) {
        await supabase.from('project_templates').update({
            description: 'The default roadmap with full guidance.',
            structure: initialRoadmapData 
          }).eq('id', existing.id);
        toast({ title: "Template Updated", description: "Standard Brand Strategy template updated." });
      } else {
        await supabase.from('project_templates').insert({
            name: 'Standard Brand Strategy',
            description: 'The default roadmap with full guidance.',
            structure: initialRoadmapData 
          });
        toast({ title: "Template Created", description: "New template created." });
      }
      setStatus('Template migration complete!');
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message });
      setStatus('Template migration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW FUNCTION: Updates Existing Projects (Run this to fix your issue) ---
  const syncLiveSteps = async () => {
    setIsLoading(true);
    setStatus('Syncing live steps...');
    let updatedCount = 0;
    let missingCount = 0;

    try {
      // 1. Get all steps from the database
      const { data: allSteps, error } = await supabase.from('steps').select('id, step_name');
      
      if (error) throw error;
      if (!allSteps || allSteps.length === 0) {
        setStatus('No steps found in database.');
        setIsLoading(false);
        return;
      }

      // 2. Loop through every step in your database
      for (const step of allSteps) {
        // Find matching guidance in your file
        const guidance = stepGuidanceLibrary[step.step_name];

        if (guidance) {
          // 3. If match found, update the database with the file content
          const { error: updateError } = await supabase
            .from('steps')
            .update({
              description: guidance.description,
              why_matters: guidance.why_matters,
              guiding_questions: guidance.guiding_questions as any, // Cast to any for JSONB compatibility
              expected_output: guidance.expected_output
            })
            .eq('id', step.id);

          if (updateError) console.error(`Failed to update ${step.step_name}`, updateError);
          else updatedCount++;
        } else {
          console.warn(`No guidance found in file for DB step: "${step.step_name}"`);
          missingCount++;
        }
      }

      toast({
        title: "Sync Complete",
        description: `Updated ${updatedCount} steps. Could not match ${missingCount} steps.`,
      });
      setStatus(`Sync Complete. Updated: ${updatedCount}, Unmatched: ${missingCount}.`);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: error.message });
      setStatus('Sync failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Migration & Repair</CardTitle>
          <CardDescription>Manage templates and fix existing project data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md text-sm font-mono border border-border">
            <p className="font-semibold mb-1">Status:</p>
            <p>{status}</p>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">1. Update Template (For Future Projects)</h3>
            <Button onClick={validateAndMigrateTemplate} className="w-full" disabled={isLoading} variant="outline">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Template'}
            </Button>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-sm font-medium text-blue-600">2. Fix Existing Projects (Run This)</h3>
            <p className="text-xs text-muted-foreground">This pushes data from your file into the live database.</p>
            <Button onClick={syncLiveSteps} className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Sync Live Steps</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMigration;