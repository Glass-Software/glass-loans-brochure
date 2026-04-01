/**
 * PDF Utility Functions for @react-pdf/renderer
 * These utilities help with markdown parsing, formatting, and styling
 */

/**
 * Parse markdown text and return structured data for PDF rendering
 * Supports: headers (##), bold (**text**), italic (*text*)
 */
export interface MarkdownElement {
  type: 'header' | 'paragraph' | 'text';
  content: string;
  bold?: boolean;
  italic?: boolean;
}

export function parseMarkdownToPDFElements(text: string): MarkdownElement[] {
  if (!text) return [];

  const elements: MarkdownElement[] = [];
  const lines = text.split('\n');
  let currentParagraph: MarkdownElement[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      // Combine all text elements in paragraph with space separator
      const combinedText = currentParagraph.map(el => el.content).join(' ');
      // Check if paragraph has any bold/italic formatting
      const hasBold = currentParagraph.some(el => el.bold);
      const hasItalic = currentParagraph.some(el => el.italic);

      elements.push({
        type: 'text',
        content: combinedText,
        bold: hasBold && currentParagraph.every(el => !el.content.trim() || el.bold),
        italic: hasItalic && currentParagraph.every(el => !el.content.trim() || el.italic),
      });
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty lines end the current paragraph
    if (!trimmedLine) {
      flushParagraph();
      elements.push({ type: 'paragraph', content: '' });
      continue;
    }

    // Headers end the current paragraph
    if (trimmedLine.startsWith('##')) {
      flushParagraph();
      const headerText = trimmedLine.replace(/^##\s*/, '');
      elements.push({ type: 'header', content: headerText });
      continue;
    }

    // Parse inline formatting and add to current paragraph
    const inlineElements = parseInlineFormatting(trimmedLine);
    currentParagraph.push(...inlineElements);
  }

  // Flush any remaining paragraph
  flushParagraph();

  return elements;
}

/**
 * Parse inline formatting like **bold** and *italic*
 */
function parseInlineFormatting(text: string): MarkdownElement[] {
  const elements: MarkdownElement[] = [];

  // Simple regex-based parsing
  // This handles **bold** and *italic* (not nested)
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold text
      const content = part.slice(2, -2);
      elements.push({ type: 'text', content, bold: true });
    } else if (part.startsWith('*') && part.endsWith('*')) {
      // Italic text
      const content = part.slice(1, -1);
      elements.push({ type: 'text', content, italic: true });
    } else {
      // Regular text
      elements.push({ type: 'text', content: part });
    }
  }

  return elements;
}

/**
 * Format date as "January 15, 2026"
 */
export function formatDateForPDF(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Get color hex code based on score
 * Green 80+, Blue 60-79, Yellow 40-59, Red <40
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981'; // Green (success)
  if (score >= 60) return '#4A6CF7'; // Blue (primary)
  if (score >= 40) return '#F59E0B'; // Yellow (warning)
  return '#DC2626'; // Red (danger)
}

/**
 * Truncate text with ellipsis if it exceeds maxLength
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize filename by removing special characters
 */
export function sanitizeFilename(text: string, maxLength: number = 50): string {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, maxLength); // Limit length
}

/**
 * Brand colors for consistent styling across PDF
 */
export const BRAND_COLORS = {
  primary: '#4A6CF7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#DC2626',
  gray: '#6B7280',
  darkGray: '#374151',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',
};

/**
 * Common font sizes for PDF documents
 */
export const FONT_SIZES = {
  title: 24,
  heading: 18,
  subheading: 14,
  body: 11,
  small: 9,
  caption: 8,
};

/**
 * Common spacing values
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
