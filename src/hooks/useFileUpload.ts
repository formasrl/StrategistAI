import { useRef, useState } from 'react';
import mammoth from 'mammoth';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { showError, showSuccess } from '@/utils/toast';

/**
 * @name useFileUpload
 * @description A custom hook for handling file uploads and converting them to HTML.
 * @param documentId The ID of the document to upload to.
 * @param onContentAdd A callback function to add the converted HTML to the document.
 * @returns {object} The uploading state, a ref for the file input, and functions to trigger and handle file uploads.
 */
export const useFileUpload = (documentId: string | undefined, onContentAdd: (content: string) => void) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !documentId) return;

    setIsUploading(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let contentHtml = '';

      if (fileExtension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        contentHtml = result.value;
      } else if (fileExtension === 'html') {
        contentHtml = await file.text();
      } else if (fileExtension === 'md') {
        const markdownText = await file.text();
        contentHtml = marked.parse(markdownText) as string;
      } else {
        showError('Unsupported file type. Please upload .docx, .html, or .md files.');
        setIsUploading(false);
        return;
      }

      const sanitizedHtml = DOMPurify.sanitize(contentHtml);
      onContentAdd(sanitizedHtml);
      showSuccess('File content inserted successfully!');
    } catch (error: any) {
      console.error('File upload error:', error);
      showError(`Failed to process file: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return {
    isUploading,
    fileInputRef,
    triggerFileUpload,
    handleFileChange,
  };
};
