# Install

```sh
pnpm add @viro-external/meta
# or: npm install @viro-external/meta
```

This pulls the three real packages as transitive deps:

- `react-native-viro-mux` (PROMPT-1) — native bridge
- `@viro-external/core` (PROMPT-2/3/4) — spatial primitives
- `@viro-external/gui` (PROMPT-5/6) — Babylon GUI3D port

## Native rebuild required

`react-native-viro-mux` and `@viro-external/core`'s splat renderer are **native** packages. Adding this dependency requires a native rebuild:

```sh
# Expo
pnpm expo prebuild --clean
pnpm expo run:ios   # or run:android
```

There is **no Expo Go support** and **no over-the-air (OTA) install** — the native modules are not part of the JS bundle.

## Peer dependencies

You must already have:

| Peer                          | Version       |
| ----------------------------- | ------------- |
| `@reactvision/react-viro`     | `2.56.0`      |
| `react-native`                | `0.86.0`      |
| `react`                       | any           |
| `expo`                        | `56.x`        |
