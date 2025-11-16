import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentVersion } from '@/types/supabase';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, History, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils/dateUtils'; // New import

interface DocumentVersionListProps {
  documentId: string;
  currentVersionNumber: number;
  onViewVersion: (versionContent: string, versionNumber: number) => void;
}

const DocumentVersionList: React.FC<DocumentVersionListProps> = ({
  documentId,
  currentVersionNumber,
  onViewVersion,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const fetchVersions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: false }); // Show latest versions first

    if (error) {
      showError(`Failed to load document versions: ${error.message}`);
      setVersions([]);
    } else {
      setVersions(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (documentId) {
      fetchVersions();
    }
  }, [documentId]);

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-2">
        <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" /> Document History
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                <span className="sr-only">Toggle versions</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-4">
            <div className="border-t border-border pt-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-muted-foreground text-sm italic text-center">No previous versions found.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        version.version === currentVersionNumber ? 'bg-primary/10 border-primary' : 'bg-muted/20 hover:bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">Version {version.version} {version.version === currentVersionNumber && '(Current)'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(version.created_at, 'MMM d, yyyy HH:mm')}
                        </p>
                        {version.change_description && (
                          <p className="text-xs text-muted-foreground italic">
                            {version.change_description}
                          </p>
                        )}
                      </div>
                      {version.version !== currentVersionNumber && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewVersion(version.content, version.version)}
                        >
                          <FileText className="mr-2 h-4 w-4" /> View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
};

export default DocumentVersionList;