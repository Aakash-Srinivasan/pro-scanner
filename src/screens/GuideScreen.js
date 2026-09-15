import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RFValue } from 'react-native-responsive-fontsize';
import Constants from 'expo-constants';
import Screen from '../components/Screen';
import Header from '../components/Header';
import { colors, spacing, radius, typography, shadow } from '../theme';

// Read from app.json rather than hardcoded, so this can never drift out of
// sync with the version actually configured for the current build.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const DEVELOPER_NAME = 'Aakash Srinivasan';
const DEVELOPER_WEBSITE = 'https://aakash-srinivasan.netlify.app/';
const DEVELOPER_CONTACT = null;

// Plain data so the guide's content is easy to scan, edit, and keep in sync
// as features change - the render logic below just walks these arrays.
const FEATURES = [
  {
    icon: 'camera',
    title: 'Scan a Document',
    steps: [
      'Tap Scan Document on the Home screen.',
      'Line up your document and tap the shutter (or pick an existing photo from your gallery).',
      "Drag the four corner handles to match the document's edges, then tap Confirm.",
      'Add more pages the same way, or tap Done to build your PDF.',
    ],
  },
  {
    icon: 'qr-code-outline',
    title: 'Scan a QR Code or Barcode',
    steps: [
      'Tap Scan Barcode on the Home screen (or tap the QR icon in the top-right corner while scanning a document).',
      "Point your camera at a QR code or barcode - it's detected automatically.",
      "Choose Copy to copy the text, or Open Link if it's a web address.",
      'Tap the camera icon to switch to normal document scanning.',
    ],
  },
  {
    icon: 'copy-outline',
    title: 'Organize Pages Before Saving',
    steps: [
      'On the Pages screen, tap the pencil next to the file name at the top to rename it.',
      'Use the up/down arrows on a page to reorder it.',
      "Tap the refresh icon to re-adjust a page's corners, or the trash icon to remove it.",
      'Tap Add Page to capture another page before finishing.',
      'Tap Done when your document is ready.',
    ],
  },
  {
    icon: 'document-text-outline',
    title: 'Rename, Reduce Size & Watermark',
    steps: [
      'On the Preview screen, tap the pencil next to the file name to rename your scan.',
      'Tap Reduce File Size to compare Low / Medium / High and pick a smaller version.',
      "Tap Add Watermark to stamp text like \"CONFIDENTIAL\" across every page.",
      'Tap the small share icon on any page thumbnail to send just that page as an image.',
    ],
  },
  {
    icon: 'download-outline',
    title: 'Save, Share & Download',
    steps: [
      'Download or Save writes the PDF straight to your device (Android lets you choose the folder).',
      'Share opens your phone\'s share sheet to send it anywhere.',
      'New Scan starts a fresh document - your current one is already safe in History.',
    ],
  },
  {
    icon: 'time-outline',
    title: 'History',
    steps: [
      'Every finished scan is saved here automatically.',
      'Use the search bar to find a scan by name.',
      'Tap the checkbox icon to select multiple scans and Merge them into one PDF.',
      'Tap the pencil on a scan to edit its pages, or the trash icon to delete it.',
    ],
  },
  {
    icon: 'contract-outline',
    title: 'Compress an Existing PDF',
    steps: [
      'From Home, tap Compress PDF.',
      'Choose any PDF file already on your device.',
      'Pick a quality level and tap Compress.',
      'Save or Share the smaller file.',
    ],
  },
  {
    icon: 'create-outline',
    title: 'Sign a PDF',
    steps: [
      'From Home, tap Sign PDF.',
      'Choose any PDF file already on your device.',
      'Draw your signature, then tap Next: Position Signature.',
      'Drag it anywhere on the page preview, then tap Apply Signature.',
      'Save or Share the result.',
    ],
  },
  {
    icon: 'shield-checkmark-outline',
    title: "Never Lose an Unfinished Scan",
    steps: [
      "If the app closes while you're mid-scan, your progress is saved automatically.",
      'Next time you open Pro Scanner, you\'ll be asked whether to resume or discard it.',
    ],
  },
];

const FAQS = [
  {
    q: 'Is my data stored online?',
    a: 'No. Pro Scanner works completely offline - your photos and PDFs never leave your device unless you choose to share them.',
  },
  {
    q: 'Do I need an account or to sign in?',
    a: "No. There's no login - just open the app and start scanning.",
  },
  {
    q: 'Where do my saved scans go?',
    a: 'Every finished scan is kept in History inside the app. Saved or Downloaded copies also go wherever you chose - a folder on your device, or through your phone\'s share sheet.',
  },
  {
    q: "Can I edit a scan after I've already saved it?",
    a: 'Yes. Open History and tap the pencil icon on any scan to add, remove, reorder, or redo its pages.',
  },
  {
    q: "Why isn't the text in my compressed PDF selectable anymore?",
    a: "Compress PDF works by turning each page into a picture and shrinking that - it's built for scanned or photographed documents. If the original PDF had real, selectable text, that text becomes part of the image and can no longer be selected or searched.",
  },
  {
    q: 'Will Pro Scanner work without internet?',
    a: 'Yes - every feature works fully offline.',
  },
  {
    q: 'Is Dark Mode available?',
    a: "Not yet - it's planned for a future update.",
  },
];

function FeatureCard({ icon, title, steps }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureHeader}>
        <View style={styles.featureIconWrap}>
          <Ionicons name={icon} size={20} color={colors.accent} />
        </View>
        <Text style={styles.featureTitle}>{title}</Text>
      </View>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <TouchableOpacity style={styles.faqItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.faqQuestionRow}>
        <Text style={styles.faqQuestion}>{q}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </View>
      {isOpen && <Text style={styles.faqAnswer}>{a}</Text>}
    </TouchableOpacity>
  );
}

export default function GuideScreen({ navigation }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex((current) => (current === index ? null : index));
  };

  return (
    <Screen>
      <Header title="Help & Guide" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Everything Pro Scanner can do, in one place.</Text>

        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}

        <Text style={styles.faqHeading}>Frequently Asked Questions</Text>
        <View style={styles.faqGroup}>
          {FAQS.map((faq, index) => (
            <FaqItem
              key={faq.q}
              q={faq.q}
              a={faq.a}
              isOpen={openFaqIndex === index}
              onToggle={() => toggleFaq(index)}
            />
          ))}
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutAppName}>Pro Scanner</Text>
          <Text style={styles.aboutVersion}>Version {APP_VERSION}</Text>
          <Text style={styles.aboutDeveloper}>Made by {DEVELOPER_NAME}</Text>
          {DEVELOPER_WEBSITE && (
            <TouchableOpacity onPress={() => Linking.openURL(DEVELOPER_WEBSITE)}>
              <Text style={styles.aboutLink}>{DEVELOPER_WEBSITE}</Text>
            </TouchableOpacity>
          )}
          {DEVELOPER_CONTACT && (
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${DEVELOPER_CONTACT}`)}>
              <Text style={styles.aboutLink}>{DEVELOPER_CONTACT}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    ...typography.subtitle,
    marginBottom: spacing.lg,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    ...typography.body,
    fontFamily: 'Nunito-Bold',
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.label,
    color: colors.accent,
    width: 16,
  },
  stepText: {
    ...typography.body,
    fontSize: RFValue(14),
    flex: 1,
  },
  faqHeading: {
    ...typography.title,
    fontSize: RFValue(18),
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  faqGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow,
  },
  faqItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  faqQuestion: {
    ...typography.body,
    fontFamily: 'Nunito-Bold',
    flex: 1,
  },
  faqAnswer: {
    ...typography.body,
    fontSize: RFValue(14),
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  aboutCard: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aboutAppName: {
    ...typography.body,
    fontFamily: 'Nunito-Bold',
  },
  aboutVersion: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: 2,
  },
  aboutDeveloper: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  aboutLink: {
    ...typography.label,
    color: colors.accent,
    marginTop: spacing.xs,
  },
});
