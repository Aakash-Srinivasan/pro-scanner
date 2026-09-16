// Resets the navigation stack to just this one route, so the hardware back
// button can't unwind through Intro/Onboarding/the scan flow that led here.
// Use this whenever "returning to X" should behave like arriving fresh,
// not like popping back through everywhere you've been.
export function resetTo(navigation, routeName, params) {
  navigation.reset({ index: 0, routes: [{ name: routeName, params }] });
}
