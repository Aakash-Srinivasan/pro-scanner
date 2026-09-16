import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, PanResponder, useWindowDimensions, Alert } from 'react-native';
import Screen from '../components/Screen';
import Header from '../components/Header';
import Button from '../components/Button';
import ImageProcessor from '../utils/ImageProcessor';
import { useScanSession } from '../context/ScanSessionContext';
import { useTheme } from '../context/ThemeContext';

const HANDLE_SIZE = 28;
const EDGE_THICKNESS = 2;
// Rough vertical space the header + "Confirm" button reserve, so the photo
// never gets sized so tall it pushes the button off-screen on short devices.
const RESERVED_VERTICAL_SPACE = 220;

// Draws the line from `from` to `to` so the 4 handles read as a connected
// quadrilateral (the actual crop boundary) instead of 4 floating dots.
// Reads the theme itself (rather than via a prop) since it's a standalone
// top-level component, not nested inside PageEditScreen's own function body.
function Edge({ from, to }) {
  const { colors } = useTheme();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          height: EDGE_THICKNESS,
          backgroundColor: colors.accent,
        },
        {
          left: from.x,
          top: from.y - EDGE_THICKNESS / 2,
          width: length,
          transform: [{ rotate: `${angle}deg` }],
          transformOrigin: '0% 50%',
        },
      ]}
    />
  );
}

function Handle({ point, onMove, bounds }) {
  const { colors } = useTheme();
  // `point`/`bounds` are read from refs kept in sync on every render (not
  // from the closure captured when PanResponder.create() first ran) so a
  // second drag on the same handle starts from where it actually is, not
  // from its position when the component first mounted.
  const pointRef = useRef(point);
  pointRef.current = point;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const gestureStart = useRef(point);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStart.current = pointRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        const next = {
          x: clamp(gestureStart.current.x + gesture.dx, 0, boundsRef.current.width),
          y: clamp(gestureStart.current.y + gesture.dy, 0, boundsRef.current.height),
        };
        onMove(next);
      },
    })
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={[
        {
          position: 'absolute',
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          borderRadius: HANDLE_SIZE / 2,
          backgroundColor: colors.accent,
          borderWidth: 3,
          borderColor: colors.white,
        },
        { left: point.x - HANDLE_SIZE / 2, top: point.y - HANDLE_SIZE / 2 },
      ]}
    />
  );
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export default function PageEditScreen({ route, navigation }) {
  const { pageId } = route.params;
  const { pages, updatePage, removePage } = useScanSession();
  const { spacing, typography } = useTheme();
  const page = pages.find((p) => p.id === pageId);

  const processorRef = useRef(null);
  const [displaySize, setDisplaySize] = useState(null);
  const [corners, setCorners] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Reactive window size (not a static snapshot) so the displayed photo -
  // and therefore the corner handles overlaid on it - stay correctly sized
  // if the device rotates or a split-screen window is resized.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const maxDisplayWidth = windowWidth - spacing.xl * 2;
  const maxDisplayHeight = Math.max(windowHeight - RESERVED_VERTICAL_SPACE, 200);

  useEffect(() => {
    if (!page) return;
    Image.getSize(
      page.uri,
      (naturalWidth, naturalHeight) => {
        const scale = Math.min(maxDisplayWidth / naturalWidth, maxDisplayHeight / naturalHeight);
        const width = naturalWidth * scale;
        const height = naturalHeight * scale;
        setDisplaySize({ width, height, scale, naturalWidth, naturalHeight });
        setCorners([
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ]);
      },
      () => Alert.alert('Error', 'Could not load photo dimensions.')
    );
  }, [page?.uri, maxDisplayWidth, maxDisplayHeight]);

  const cornerLabels = useMemo(() => ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'], []);

  const handleRetake = () => {
    removePage(pageId);
    navigation.goBack();
  };

  const styles = StyleSheet.create({
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageWrapper: {
      alignSelf: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.xl + HANDLE_SIZE,
      backgroundColor: '#000',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      marginTop: 'auto',
      marginBottom: spacing.xl,
      gap: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
  });

  if (!page) {
    return (
      <Screen style={styles.center}>
        <Text style={typography.body}>Page not found.</Text>
      </Screen>
    );
  }

  const updateCorner = (index, next) => {
    setCorners((prev) => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  const handleConfirm = async () => {
    if (!displaySize || !corners) return;
    setProcessing(true);
    try {
      const imageSpaceCorners = corners.map((c) => ({
        x: c.x / displaySize.scale,
        y: c.y / displaySize.scale,
      }));

      const processedUri = await processorRef.current.process({
        uri: page.uri,
        corners: imageSpaceCorners,
      });

      updatePage(pageId, { corners: imageSpaceCorners, processedUri });
      navigation.replace('Pages');
    } catch (error) {
      console.error('Error processing page:', error);
      Alert.alert('Error', 'Failed to process this page. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Screen>
      <Header title="Adjust" subtitle="Drag the corners to match the document edges" onBack={handleRetake} />

      {displaySize && (
        <View style={[styles.imageWrapper, { width: displaySize.width, height: displaySize.height }]}>
          <Image
            source={{ uri: page.uri }}
            style={{ width: displaySize.width, height: displaySize.height }}
            resizeMode="contain"
          />
          <Edge from={corners[0]} to={corners[1]} />
          <Edge from={corners[1]} to={corners[2]} />
          <Edge from={corners[2]} to={corners[3]} />
          <Edge from={corners[3]} to={corners[0]} />
          {corners.map((point, index) => (
            <Handle
              key={cornerLabels[index]}
              point={point}
              bounds={displaySize}
              onMove={(next) => updateCorner(index, next)}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title={processing ? 'Processing...' : 'Confirm'}
          onPress={handleConfirm}
          disabled={processing}
          loading={processing}
          style={styles.actionButton}
        />
      </View>

      <ImageProcessor ref={processorRef} />
    </Screen>
  );
}
