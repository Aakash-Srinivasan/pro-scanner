import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';

// Perspective correction + filters, done entirely with <canvas> inside a
// hidden WebView. This avoids needing a native image-processing module
// (which would require a custom dev client instead of Expo Go): the quad
// is warped to a rectangle using the classic "split into two triangles,
// solve an affine transform per triangle" technique, since canvas 2D has
// no built-in projective transform.
const PROCESSOR_HTML = `
<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#000;">
<canvas id="c"></canvas>
<script>
function solveAffine(sx0,sy0,sx1,sy1,sx2,sy2, dx0,dy0,dx1,dy1,dx2,dy2) {
  const denom = sx0*(sy1-sy2) + sx1*(sy2-sy0) + sx2*(sy0-sy1);
  if (denom === 0) return null;
  const a = (dx0*(sy1-sy2) + dx1*(sy2-sy0) + dx2*(sy0-sy1)) / denom;
  const b = (dy0*(sy1-sy2) + dy1*(sy2-sy0) + dy2*(sy0-sy1)) / denom;
  const c = (dx0*(sx2-sx1) + dx1*(sx0-sx2) + dx2*(sx1-sx0)) / denom;
  const d = (dy0*(sx2-sx1) + dy1*(sx0-sx2) + dy2*(sx1-sx0)) / denom;
  const e = (dx0*(sx1*sy2-sx2*sy1) + dx1*(sx2*sy0-sx0*sy2) + dx2*(sx0*sy1-sx1*sy0)) / denom;
  const f = (dy0*(sx1*sy2-sx2*sy1) + dy1*(sx2*sy0-sx0*sy2) + dy2*(sx0*sy1-sx1*sy0)) / denom;
  return [a, b, c, d, e, f];
}

function warpTriangle(ctx, img, src, dst) {
  const m = solveAffine(
    src[0].x, src[0].y, src[1].x, src[1].y, src[2].x, src[2].y,
    dst[0].x, dst[0].y, dst[1].x, dst[1].y, dst[2].x, dst[2].y
  );
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dst[0].x, dst[0].y);
  ctx.lineTo(dst[1].x, dst[1].y);
  ctx.lineTo(dst[2].x, dst[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function dist(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function process(payload) {
  const { base64, corners, quality } = payload;
  const jpegQuality = typeof quality === 'number' ? quality : 0.85;
  const img = new Image();
  img.onload = function () {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    const useCorners = corners && corners.length === 4;
    const c0 = useCorners ? corners[0] : { x: 0, y: 0 };
    const c1 = useCorners ? corners[1] : { x: img.naturalWidth, y: 0 };
    const c2 = useCorners ? corners[2] : { x: img.naturalWidth, y: img.naturalHeight };
    const c3 = useCorners ? corners[3] : { x: 0, y: img.naturalHeight };

    const outW = Math.round((dist(c0, c1) + dist(c3, c2)) / 2);
    const outH = Math.round((dist(c0, c3) + dist(c1, c2)) / 2);
    canvas.width = Math.max(outW, 1);
    canvas.height = Math.max(outH, 1);

    const dst = [
      { x: 0, y: 0 },
      { x: canvas.width, y: 0 },
      { x: canvas.width, y: canvas.height },
      { x: 0, y: canvas.height },
    ];

    warpTriangle(ctx, img, [c0, c1, c3], [dst[0], dst[1], dst[3]]);
    warpTriangle(ctx, img, [c1, c2, c3], [dst[1], dst[2], dst[3]]);

    const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    post({ ok: true, base64: dataUrl.split(',')[1] });
  };
  img.onerror = function () {
    post({ ok: false, error: 'Failed to load image' });
  };
  img.src = 'data:image/jpeg;base64,' + base64;
}

function post(msg) {
  const json = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json);
}

function handleMessage(event) {
  try {
    const payload = JSON.parse(event.data);
    process(payload);
  } catch (e) {
    post({ ok: false, error: String(e) });
  }
}

document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);
</script>
</body>
</html>
`;

const ImageProcessor = forwardRef(function ImageProcessor(_props, ref) {
  const webviewRef = useRef(null);
  const pendingRef = useRef(null);

  useImperativeHandle(ref, () => ({
    async process({ uri, corners, quality }) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const resultBase64 = await new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        webviewRef.current?.postMessage(JSON.stringify({ base64, corners, quality }));
      });

      const outputUri = `${FileSystem.cacheDirectory}scan-${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(outputUri, resultBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return outputUri;
    },
  }));

  const onMessage = (event) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.ok) {
        pending.resolve(data.base64);
      } else {
        pending.reject(new Error(data.error || 'Image processing failed'));
      }
    } catch (e) {
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

export default ImageProcessor;
