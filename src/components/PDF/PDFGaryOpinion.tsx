import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  parseMarkdownToPDFElements,
  BRAND_COLORS,
  FONT_SIZES,
  SPACING,
} from '@/lib/pdf/pdfUtils';

interface PDFGaryOpinionProps {
  opinion: string;
}

export default function PDFGaryOpinion({ opinion }: PDFGaryOpinionProps) {
  const elements = parseMarkdownToPDFElements(opinion);

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>G</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Gary's Opinion</Text>
          <Text style={styles.headerSubtitle}>Senior Underwriter</Text>
        </View>
      </View>

      {/* Opinion Content */}
      <View style={styles.content}>
        {elements.map((element, index) => {
          if (element.type === 'header') {
            return (
              <Text key={index} style={styles.markdownHeader}>
                {element.content}
              </Text>
            );
          }

          if (element.type === 'paragraph') {
            // Empty paragraph (line break)
            return <View key={index} style={styles.lineBreak} />;
          }

          // Regular text with inline formatting
          const textStyle = [
            styles.bodyText,
            element.bold && styles.boldText,
            element.italic && styles.italicText,
          ];

          return (
            <Text key={index} style={textStyle}>
              {element.content}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottom: `2px solid ${BRAND_COLORS.lightGray}`,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  headerIconText: {
    fontSize: FONT_SIZES.heading,
    color: BRAND_COLORS.white,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.subheading,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.small,
    color: BRAND_COLORS.gray,
  },
  content: {
    lineHeight: 1.6,
  },
  markdownHeader: {
    fontSize: FONT_SIZES.subheading,
    fontWeight: 'bold',
    color: BRAND_COLORS.black,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bodyText: {
    fontSize: FONT_SIZES.body,
    color: BRAND_COLORS.darkGray,
    lineHeight: 1.6,
  },
  boldText: {
    fontWeight: 'bold',
  },
  italicText: {
    fontStyle: 'italic',
  },
  lineBreak: {
    height: SPACING.sm,
  },
});
