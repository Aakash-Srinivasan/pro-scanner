import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'pro-scanner:has-onboarded';

export async function hasCompletedOnboarding() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
  } catch (error) {
    console.error('Error reading onboarding flag:', error);
    return false;
  }
}

export async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (error) {
    console.error('Error saving onboarding flag:', error);
  }
}
