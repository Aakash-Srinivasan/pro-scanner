import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFJS_LIB_SOURCE } from './pdfjsLibSource';
import { PDFJS_WORKER_SOURCE } from './pdfjsWorkerSource';

const escapeScriptClose = (code) => code.replace(/<\/script/gi, '<\\/script');

// Renders a single PDF page to a picture, so the user can see exactly where
// their signature will land before applying it (see SignPdfScreen.js) -
// same pdf.js-in-a-hidden-WebView technique as PdfCompressor.js, trimmed
// down to just "load a document, then render one page on request" with no
// multi-page browsing UI of its own.
const PREVIEW_HTML = `
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

  var currentPdf = null;

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  async function load(payload) {
    currentPdf = await pdfjsLib.getDocument({ data: base64ToBytes(payload.base64) }).promise;
    post({ type: 'result', op: 'load', ok: true, pageCount: currentPdf.numPages });
  }

  async function renderPage(payload) {
    if (!currentPdf) throw new Error('No PDF loaded');
    const page = await currentPdf.getPage(payload.pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = (payload.targetWidth / unscaled.width) * (payload.pixelRatio || 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    post({
      type: 'result',
      op: 'renderPage',
      ok: true,
      base64: dataUrl.split(',')[1],
      pointWidth: unscaled.width,
      pointHeight: unscaled.height,
    });
  }

  function handleMessage(event) {
    const payload = JSON.parse(event.data);
    const run = payload.op === 'load' ? load : renderPage;
    run(payload).catch((e) => post({ type: 'result', op: payload.op, ok: false, error: String(e) }));
  }

  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);
})();
</script>
</body>
</html>
`;

const PdfPagePreview = forwardRef(function PdfPagePreview(_props, ref) {
  const webviewRef = useRef(null);
  const pendingRef = useRef(null);

  const call = (op, payload) =>
    new Promise((resolve, reject) => {
      pendingRef.current = { op, resolve, reject };
      webviewRef.current?.postMessage(JSON.stringify({ op, ...payload }));
    });

  useImperativeHandle(ref, () => ({
    async load({ uri }) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await call('load', { base64 });
      return { pageCount: result.pageCount };
    },

    // pointWidth/pointHeight are the page's own size in PDF points -
    // exactly what's needed to convert a drag position on the displayed
    // preview back into real PDF coordinates.
    async renderPage({ pageNumber, targetWidth, pixelRatio }) {
      const result = await call('renderPage', { pageNumber, targetWidth, pixelRatio });
      const outUri = `${FileSystem.cacheDirectory}pdfpreview-${pageNumber}-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(outUri, result.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri: outUri, pointWidth: result.pointWidth, pointHeight: result.pointHeight };
    },
  }));

  const onMessage = (event) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.ok) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(data.error || `PDF ${data.op} failed`));
      }
    } catch (e) {
      pending.reject(e);
    }
  };

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html: PREVIEW_HTML }}
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

export default PdfPagePreview;
