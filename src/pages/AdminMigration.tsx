import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { initialRoadmapData } from '@/utils/initialRoadmapData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

const AdminMigration: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('Ready to migrate');

  const validateAndMigrate = async () => {
    setIsLoading(true);
    setStatus('Validating data...');

    // Validation Step
    const validationErrors: string[] = [];
    let totalSteps = 0;
    
    initialRoadmapData.forEach((phase) => {
      phase.steps.forEach((step) => {
        totalSteps++;
        // Check description
        if (!step.description || step.description.trim() === '') {
          validationErrors.push(`Step '${step.step_name}' (Phase ${phase.phase_number}) is missing a description.`);
        }
        // Check guiding questions
        if (!step.guiding_questions || step.guiding_questions.length === 0) {
          validationErrors.push(`Step '${step.step_name}' (Phase ${phase.phase_number}) is missing guiding questions.`);
        }
      });
    });

    if (validationErrors.length > 0) {
      console.error("Validation Errors:", validationErrors);
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: `Found ${validationErrors.length} errors. Check console for full list. First error: ${validationErrors[0]}`,
      });
      setStatus(`Validation failed. Found ${validationErrors.length} errors.`);
      setIsLoading(false);
      return;
    }

    setStatus(`Validation passed (${totalSteps} steps). Migrating...`);

    try {
      // Migration Step
      // First, let's see if a template with this name already exists to avoid duplicates/spamming
      const { data: existing } = await supabase
        .from('project_templates')
        .select('id')
        .eq('name', 'Standard Brand Strategy')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('project_templates')
          .update({
            description: 'The default roadmap with full guidance.',
            structure: initialRoadmapData // Supabase handles JSON conversion
          })
          .eq('id', existing.id);
          
        if (error) throw error;
        toast({
          title: "Template Updated",
          description: "Existing 'Standard Brand Strategy' template updated successfully.",
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('project_templates')
          .insert({
            name: 'Standard Brand Strategy',
            description: 'The default roadmap with full guidance.',
            structure: initialRoadmapData // Supabase handles JSON conversion
          });

        if (error) throw error;
        toast({
          title: "Migration Successful",
          description: "New project template created successfully.",
        });
      }

      setStatus('Migration complete!');

    } catch (error: any) {
      console.error("Migration Error:", error);
      toast({
        variant: "destructive",
        title: "Migration Failed",
        description: error.message || "Unknown error occurred",
      });
      setStatus('Migration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Migration</CardTitle>
          <CardDescription>Validate and upload local roadmap data to Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-md text-sm font-mono border border-border">
            <p className="font-semibold mb-1">Status:</p>
            <p>{status}</p>
          </div>
          
          <Button 
            onClick={validateAndMigrate} 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              'Validate & Migrate'
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center mt-2">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Only run this when updating the core roadmap structure.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMigration;