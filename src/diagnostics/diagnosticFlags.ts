/** Temporary, production-safe diagnostic flag for isolating whether a
 *  Reanimated/Worklets animation mounted before or during the auth/
 *  onboarding session transition caused the Build 11 crash (TestFlight
 *  crash report: EXC_CRASH/SIGABRT inside
 *  RNWorklets::AnimationFrameBatchinator::flush() -> Hermes
 *  throwPendingError — a UI-thread worklet frame callback, not a normal
 *  JS render exception, so no React error boundary can catch it).
 *
 *  When true, every component that can mount before or during
 *  authentication/onboarding renders a fully static implementation
 *  instead — no shared values, no useAnimatedStyle, no withSpring/
 *  withTiming, nothing from react-native-reanimated or its worklets
 *  runtime created at all in that tree. Set only via
 *  EXPO_PUBLIC_DISABLE_AUTH_WORKLETS=true for one diagnostic build.
 *  Remove this flag and every branch that reads it once the crash is
 *  isolated. */
export const DISABLE_AUTH_WORKLETS = process.env.EXPO_PUBLIC_DISABLE_AUTH_WORKLETS === 'true';
