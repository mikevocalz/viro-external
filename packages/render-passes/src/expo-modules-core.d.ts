// Local type shim for expo-modules-core.
//
// This package peer-depends on expo-modules-core but does NOT install it as a
// devDep — installing at the workspace level pollutes decax9's autolink search
// path with an expo-modules-core copy that's incompatible with its RN version.
// The real module is resolved at runtime through the host app's dep tree.
declare module 'expo-modules-core' {
  export function requireOptionalNativeModule<T = unknown>(name: string): T | null;
  export function requireNativeModule<T = unknown>(name: string): T;
}
