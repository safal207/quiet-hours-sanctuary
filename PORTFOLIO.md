# Quiet Hours — portfolio case

## Problem

Make a visual idea tangible through a small interactive experience that can be explored without an account.

## Contribution

- Immediate real-model raster preview with working brightness, rain, framing and reset
- Repeatable original / atmosphere / result learning steps
- Optional low-profile WebGL loading, cancellation, bounded asynchronous waiting and explicit return to the model frame
- Three camera viewpoints, real rain/ripple visibility and exposure controls
- Pause, reduced-motion preference and background-tab suspension
- Local Three.js runtime with no CDN or external textures

The renderer is adapted from Meng To / ThreeUI Community, pinned to commit `68802d5428071ada5c20db8094b1649e6bb770ed`. Its MIT notice is preserved in `LICENSE-ThreeUI.txt`. Changes are listed in `PORTFOLIO.md`. Three.js 0.149.0 is vendored with its MIT notice.

## What a reviewer can try

1. Open the page without starting 3D. Adjust light and rain; select one of three framings.
2. Follow the three lesson buttons: original (100%, no rain), atmosphere (130%, rain), final frame (temple).
3. Pause the rain or reset the source. The result bar shows every active setting.
4. Start optional 3D. Current settings transfer to it; return to the frame without losing them.
5. If WebGL fails, continue the exercise on the prepared frame and use the visible lightweight retry.

## Verification boundary

- Node syntax, static local asset links and anchor targets checked by scripts/verify.mjs.
- Node host simulation checks the frame lesson presets, reset, reduced motion, loading-state transfer, initial/late 3D failures, context loss and explicit return to the frame.
- Pure capability policy and scene assembly checks use mocked GPU and Canvas2D; they do not certify actual rendering.
- Browser CI separately exercises the actual visitor page and preview renderer in Chromium, Firefox and Linux WebKit, with screenshots at desktop and mobile widths. Screenshots support visual review; shader execution and nonblank pixels do not certify artistic quality.
- No performance, conversion, revenue or client-use results are claimed.

## Product scope

- The base temple world is by Meng To / ThreeUI Community (MIT), not an original Safonov model.
- New contribution: visual identity, responsive page, control API, lifecycle integration, interactive real-model frame presentation, teaching steps and documentation.
- WebGL is required only for the optional 3D environment. Frame controls remain available before and during loading and after cancellation or failure.
- The initial frame is a renderer PNG with CSS brightness, framing and a rain layer. Opening 3D loads the existing procedural geometry; it does not reconstruct a model from an image.
- Physical-device FPS, native Xiaomi dark-mode behavior and Safari/iOS have not been measured in these Linux software-rendering runs.
