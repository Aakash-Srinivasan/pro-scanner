import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// A freehand drawing canvas, visible (not hidden like the app's other
// WebView-based helpers) since the user draws on it directly. Uses the same
// "canvas inside a WebView" technique as ImageProcessor.js - HTML5 canvas is
// the only freehand-drawing surface available without a native module, so
// this keeps the feature working in Expo Go.
const PAD_HTML = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; touch-action: none; background: transparent; }
    canvas { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;

function resize() {
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.lineWidth = 3 * dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1a1e';
}
resize();
window.addEventListener('resize', resize);

let drawing = false;
let lastX = 0;
let lastY = 0;
let hasStroke = false;

function post(msg) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches && e.touches.length ? e.touches[0] : e;
  return {
    x: (touch.clientX - rect.left) * (canvas.width / rect.width),
    y: (touch.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function start(e) {
  e.preventDefault();
  drawing = true;
  const p = pointFromEvent(e);
  lastX = p.x;
  lastY = p.y;
  if (!hasStroke) {
    hasStroke = true;
    post({ type: 'strokeStart' });
  }
}

function move(e) {
  if (!drawing) return;
  e.preventDefault();
  const p = pointFromEvent(e);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  lastX = p.x;
  lastY = p.y;
}

function end() {
  drawing = false;
}

canvas.addEventListener('touchstart', start, { passive: false });
canvas.addEventListener('touchmove', move, { passive: false });
canvas.addEventListener('touchend', end);
canvas.addEventListener('touchcancel', end);
canvas.addEventListener('mousedown', start);
canvas.addEventListener('mousemove', move);
window.addEventListener('mouseup', end);

function handleMessage(event) {
  const msg = JSON.parse(event.data);
  if (msg.op === 'clear') {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke = false;
    post({ type: 'cleared' });
  } else if (msg.op === 'capture') {
    post({ type: 'captured', base64: canvas.toDataURL('image/png').split(',')[1] });
  }
}

document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);
</script>
</body>
</html>
`;

// `onStrokeStart` fires the first time the user touches the pad after mount
// or after a clear - lets the screen enable its "Apply" button only once
// there's actually something drawn.
const SignaturePad = forwardRef(function SignaturePad({ onStrokeStart }, ref) {
  const webviewRef = useRef(null);
  const pendingCaptureRef = useRef(null);

  useImperativeHandle(ref, () => ({
    clear() {
      webviewRef.current?.postMessage(JSON.stringify({ op: 'clear' }));
    },
    capture() {
      return new Promise((resolve, reject) => {
        pendingCaptureRef.current = { resolve, reject };
        webviewRef.current?.postMessage(JSON.stringify({ op: 'capture' }));
      });
    },
  }));

  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'strokeStart') {
        onStrokeStart?.();
      } else if (data.type === 'captured') {
        pendingCaptureRef.current?.resolve(data.base64);
        pendingCaptureRef.current = null;
      }
    } catch (error) {
      pendingCaptureRef.current?.reject(error);
      pendingCaptureRef.current = null;
    }
  };

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html: PAD_HTML }}
      onMessage={onMessage}
      scrollEnabled={false}
      style={styles.webview}
    />
  );
});

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default SignaturePad;
