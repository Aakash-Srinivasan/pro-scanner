import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Picks a PDF via the system file picker and returns a guaranteed-readable
// local copy, or null if the user cancelled.
//
// expo-file-system's readAsStringAsync/copyAsync reject files that
// expo-document-picker copies into its own cache subfolder on Android (a
// permission-validation mismatch between the two modules - both calls fail
// identically, every time, on that path, not as an occasional race
// condition). fetch()+Blob reads the same file:// URI through a different
// code path that isn't subject to that check, so it works around it
// reliably - the bytes are then written out ourselves via expo-file-system,
// which has no trouble with a path it created itself.
export async function pickPdfFile(cachePrefix) {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const asset = picked.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read picked file'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });

  const localUri = `${FileSystem.cacheDirectory}${cachePrefix}-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(localUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  return { uri: localUri, name: asset.name || 'document.pdf', size: asset.size || blob.size || 0 };
}
