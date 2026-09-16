# Pro Scanner

A document scanner app built with **Expo** (React Native). Scan documents into PDFs, manage them, and do basic PDF utilities — all fully offline, with no login and no data ever leaving the device unless you choose to share it.

Built and tested entirely through **Expo Go** (no custom native code, no dev client) — every feature below runs on Expo's stock managed runtime.

## Tech Stack

| Purpose | Library |
|---|---|
| App framework | Expo SDK 57 / React Native 0.86 |
| Navigation | `@react-navigation/native-stack` |
| Camera | `expo-camera` (also does QR/barcode scanning) |
| File picking | `expo-document-picker`, `expo-image-picker` |
| File storage | `expo-file-system` |
| Local persistence | `@react-native-async-storage/async-storage` |
| PDF creation | `pdf-lib` |
| PDF rendering (compress) | `pdf.js` (Mozilla), run inside a hidden `react-native-webview` |
| Perspective correction | Custom canvas warp, also run inside a hidden `WebView` |
| Fonts | Nunito (via `expo-font`), sized with `react-native-responsive-fontsize` |

## Features

**Scanning**
- Camera capture or pick from gallery
- Drag-to-adjust corners for perspective correction
- Multi-page documents: reorder, delete, redo, add more pages
- QR code / barcode scanning — a standalone Home shortcut (Scan Barcode), or toggle mode within the Camera screen
- In-progress scans survive the app being closed or killed (auto-resume prompt on next launch)

**After scanning (Preview screen)**
- Rename the file (tap the pencil icon)
- Reduce File Size — Low/Medium/High presets, shows resulting size before you commit
- Add a text watermark, stamped diagonally across every page
- Share a single page as a JPEG, separate from the whole PDF
- Save (direct to a folder on Android, share sheet elsewhere), Share, or Download

**History** (reached via "See All" next to Recent on Home)
- Every finished scan is saved automatically, with thumbnails and page counts
- Search by name, switch between grid/list view, grouped by date
- Select multiple scans and merge them into one PDF
- Edit an already-saved scan's pages (updates that entry in place, doesn't duplicate it)
- **Backup & Restore** — bundles every entry (PDF + page images + metadata) into a single `.zip` via `jszip` (pure JS, no native module), for saving to a cloud drive/another device and restoring later. Restoring only adds scans; it never deletes anything.

**Standalone tools** (work on *any* PDF on your device, not just ones scanned by this app)
- **Compress PDF** — pick any PDF, shrink it. Works by rendering each page to an image with pdf.js and rebuilding the PDF from those images, since there's no native PDF-editing library available in Expo Go. This means a PDF with real, selectable text will lose that selectability after compression — it's best suited for scanned/photographed PDFs.
- **Sign PDF** — pick any PDF, draw a signature on a canvas, then drag it to wherever you want on a preview of the last page before applying it. The drawing canvas is a visible `WebView` (not hidden like the others) — HTML5 canvas is the only freehand-drawing surface available without a native module. The page preview reuses the same rasterization approach as Compress PDF.

**Other**
- Dark Mode — Light/Dark/System, switchable from the Appearance section on the Help & Guide screen, persisted across restarts
- In-app Help & Guide (info icon on Home) — full feature walkthrough plus an FAQ, and an About section (app version, developer credit)
- First-run onboarding carousel, first-run coach marks on the Camera screen

## Project Structure

```
App.js                      Navigation setup, font loading, context providers
app.json                    Expo config (name, icon, splash, package identifiers)
eas.json                    EAS Build profiles (see "Building a beta APK" below)

src/
  screens/                  One file per screen (see App.js for the navigation stack)
  components/               Shared UI pieces (Screen, Header, Button)
  context/
    ScanSessionContext.js   In-progress scan state (pages being worked on right now)
    HistoryContext.js       Saved scans, persisted to AsyncStorage + file storage
    ThemeContext.js         Light/Dark/System theme - colors, spacing, typography,
                             shadows all live here now (see note below)
  utils/
    buildPdf.js             Assembles a PDF from a list of page images
    ImageProcessor.js       Perspective warp + JPEG recompression (hidden WebView)
    PdfCompressor.js        Rasterizes + recompresses an arbitrary PDF (hidden WebView)
    SignaturePad.js          Freehand drawing canvas (visible WebView)
    PdfPagePreview.js         Renders a single PDF page to a picture (hidden WebView)
    pdfjsLibSource.js        pdf.js library, embedded as a plain string
    pdfjsWorkerSource.js      (auto-generated — see note below)
    pickFile.js              Generic version of the "pick a file reliably" helper
    pickPdfFile.js           PDF-specific wrapper around pickFile.js
    historyBackup.js         Zips/unzips a full History backup (via jszip)
    watermarkPdf.js          Stamps text onto an existing PDF's pages
```

### A note on the theme architecture

`ThemeContext.js` replaced the old static `theme.js`. Every screen now calls `useTheme()` to get the live `colors`/`spacing`/`radius`/`typography`/`shadow` for whichever mode is active, and builds its `StyleSheet.create(...)` *inside* the component (not at module load time), so it recomputes whenever the theme changes. A few screens have small standalone sub-components (e.g. `PageEditScreen.js`'s `Edge`/`Handle`, `GuideScreen.js`'s `FeatureCard`/`FaqItem`) that call `useTheme()` themselves rather than inheriting it, since they aren't nested inside their parent screen's own function body. The theme choice (Light/Dark/System) is set from the Appearance section on the Help & Guide screen and persisted via AsyncStorage.

### A note on `pdfjsLibSource.js` / `pdfjsWorkerSource.js`

These two files are Mozilla's `pdf.js` library, embedded as plain JS strings rather than imported normally. Expo Go has no native PDF renderer, so `PdfCompressor.js` and `PdfPagePreview.js` each load these strings into a hidden, invisible `WebView` and run pdf.js there — the WebView acts as a sandboxed browser engine that *can* render PDFs, and results come back to React Native via `postMessage`. They were generated once from the `pdfjs-dist` npm package (a **devDependency only** — it never ships in the app) using a small script; regenerate them the same way if pdf.js ever needs upgrading. Don't hand-edit these files.

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (Android or iOS). No build step, no simulator required.

Useful checks while developing:

```bash
npx expo-doctor          # verifies the project config and dependencies
npx expo export          # smoke-tests that the JS bundle builds cleanly
```

## Building a Beta APK (for testers, no Play Store account needed)

Expo Go only works while a dev server is running — it's not something you can hand to someone else. For that, use **EAS Build** to produce a real, installable APK:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

This uploads to Expo's build servers and gives you a shareable install link when it finishes — no Google Play Developer account required for this step. That account (a one-time $25 fee) is only needed later, when actually publishing to the Play Store, via the `production` profile in `eas.json`.

## Known Limitations

- **Compress PDF** flattens pages to images — any real, selectable text in the original PDF is lost. Works best on scanned/photographed documents.
- **Native PDF libraries** (e.g. `@kishannareshpal/expo-pdf`, `react-native-pdf`) ship real Android/iOS native code and cannot run inside Expo Go — they require switching this project to a custom development build (`expo prebuild` + `eas build --profile development`), which drops plain Expo Go support for the whole app, not just one screen. Deferred to the planned React Native CLI rebuild.
- **iOS beta distribution** isn't set up — that needs an Apple Developer account and TestFlight, unlike Android's direct-APK sideloading.
- Image/illustration assets used in onboarding are sourced from Magnific/Freepik under their free-tier license, which may require on-screen attribution depending on account tier — not yet confirmed or added.
