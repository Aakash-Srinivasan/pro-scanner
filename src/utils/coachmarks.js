import AsyncStorage from '@react-native-async-storage/async-storage';

const CAMERA_COACHMARKS_KEY = 'pro-scanner:has-seen-camera-coachmarks';

export async function hasSeenCameraCoachmarks() {
  try {
    return (await AsyncStorage.getItem(CAMERA_COACHMARKS_KEY)) === 'true';
  } catch (error) {
    console.error('Error reading coach mark flag:', error);
    return true; // fail closed - don't nag if we can't tell
  }
}

export async function markCameraCoachmarksSeen() {
  try {
    await AsyncStorage.setItem(CAMERA_COACHMARKS_KEY, 'true');
  } catch (error) {
    console.error('Error saving coach mark flag:', error);
  }
}
