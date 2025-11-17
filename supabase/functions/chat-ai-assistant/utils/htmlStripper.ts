export function stripHtmlTags(htmlContent: string): string {
  if (!htmlContent) {
    return "";
  }
  // This regex removes HTML tags, but keeps the content inside.
  // It's a simple approach and might not handle all edge cases of malformed HTML perfectly,
  // but it's sufficient for stripping common markup from rich text editors.
  return htmlContent.replace(/<[^>]*>/g, '');
}