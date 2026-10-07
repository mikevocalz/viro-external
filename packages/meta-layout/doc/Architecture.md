# Meta Horizon adapter notes

## Platform boundary

Meta VR Layout SDK is for Standard Android / React Native apps that remain non-immersive and coexist with other apps. Viro remains the renderer for full immersive scenes, 3D objects, and engine panels.

## Capacity

The application must not assume every requested window will promote. The React Native integration currently reserves two spatial slots. Use priority tiers from the shared contract and make inline/drop fallback intentional.

Suggested ordering:

- master navigation: permanent
- important inspector: primary or secondary
- popup: popup
- accessory/tip: ephemeral

## Geometry

Treat `windowWidth`, `windowHeight`, `anchor`, and priority as configuration. Avoid frame-by-frame OS window changes. Run animations within the React/Viro surface.

## Styling

Spatial-window roots should be opaque. Do not rely on transparent OS window roots; use app-owned material/glass effects inside the content surface where supported.
