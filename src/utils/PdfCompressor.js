import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFJS_LIB_SOURCE } from './pdfjsLibSource';
import { PDFJS_WORKER_SOURCE } from './pdfjsWorkerSource';

// A literal "</script" inside either embedded source would prematurely close
// the surrounding <script> tag as far as the HTML parser is concerned (it
// looks for that byte sequence regardless of JS/JSON string context). Adding
// a backslash is a no-op for how JS/JSON strings decode ("\/" === "/") but
// breaks up the sequence so the parser never sees it. Neither embedded file
// is expected to contain it (they're plain minified JS, not markup), but the
// guard is cheap and removes any doubt.
const escapeScriptClose = (code) => code.replace(/<\/script/gi, '<\\/script');

// Rasterizes an arbitrary PDF's pages with pdf.js (running entirely inside
// this hidden WebView - no native PDF library, so this still works in Expo
// Go) and hands each page back as a JPEG. This is how a PDF the app didn't
// create itself gets compressed: there's no source images to re-encode like
// there is for a scan, so each page is rendered to a picture first, then that
// picture is recompressed - see src/utils/buildPdf.js's
// buildPdfFromRasterPages for how those pictures become a PDF again. That
// trade-off (any real text in the original becomes a flat image) is the
// unavoidable cost of compressing a PDF without a native rendering engine.
const PROCESSOR_HTML = `
<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#000;">
<script>${escapeScriptClose(PDFJS_LIB_SOURCE)}</script>
<script>
window.__PDFJS_WORKER_SRC__ = ${JSON.stringify(PDFJS_WORKER_SOURCE).replace(/<\/script/gi, '<\\/script')};
</script>
<script>
(function () {
  var workerBlob = new Blob([window.__PDFJS_WORKER_SRC__], { type: 'application/javascript' });
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  async function compress(payload) {
    const { base64, quality, renderScale } = payload;
    const pdf = await pdfjsLib.getDocument({ data: base64ToBytes(base64) }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // The page's own (unscaled) viewport is already in PDF points, which
      // is exactly the coordinate system pdf-lib's addPage expects - so the
      // rebuilt PDF keeps the original's exact page size regardless of the
      // resolution chosen below for the rendered picture.
      const pointViewport = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(renderViewport.width));
      canvas.height = Math.max(1, Math.round(renderViewport.height));
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      pages.push({
        base64: dataUrl.split(',')[1],
        pointWidth: pointViewport.width,
        pointHeight: pointViewport.height,
      });
      post({ type: 'progress', current: i, total: pdf.numPages });
    }

    post({ type: 'result', ok: true, pages, pageCount: pdf.numPages });
  }

  function handleMessage(event) {
    try {
      compress(JSON.parse(event.data)).catch((e) => post({ type: 'result', ok: false, error: String(e) }));
    } catch (e) {
      post({ type: 'result', ok: false, error: String(e) });
    }
  }

  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);
})();
</script>
</body>
</html>
`;

const PdfCompressor = forwardRef(function PdfCompressor(_props, ref) {
  const webviewRef = useRef(null);
  const pendingRef = useRef(null);

  useImperativeHandle(ref, () => ({
    // `onProgress(current, total)` is optional and fires once per rendered
    // page while a multi-page PDF is still being processed.
    async compress({ uri, quality, renderScale }, onProgress) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject, onProgress };
        webviewRef.current?.postMessage(JSON.stringify({ base64, quality, renderScale }));
      });

      const pages = [];
      for (let i = 0; i < result.pages.length; i++) {
        const page = result.pages[i];
        const outUri = `${FileSystem.cacheDirectory}pdfcompress-${Date.now()}-${i}.jpg`;
        await FileSystem.writeAsStringAsync(outUri, page.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        pages.push({ uri: outUri, pointWidth: page.pointWidth, pointHeight: page.pointHeight });
      }
      return { pages, pageCount: result.pageCount };
    },
  }));

  const onMessage = (event) => {
    const pending = pendingRef.current;
    if (!pending) return;

    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'progress') {
        pending.onProgress?.(data.current, data.total);
        return;
      }
      pendingRef.current = null;
      if (data.ok) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(data.error || 'PDF compression failed'));
      }
    } catch (e) {
      pendingRef.current = null;
      pending.reject(e);
    }
  };

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html: PROCESSOR_HTML }}
      onMessage={onMessage}
      style={styles.hidden}
    />
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default PdfCompressor;
