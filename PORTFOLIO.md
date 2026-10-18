# Quiet Hours — portfolio case

## Problem

Make a visual idea tangible through a small interactive experience that can be explored without an account.

## Contribution

- Immediate 2D illustration with working brightness, rain, framing and reset
- Repeatable original / atmosphere / result learning steps
- Optional lazy WebGL loading and explicit return to 2D
- Three camera viewpoints, real rain/ripple visibility and exposure controls
- Pause, reduced-motion preference and background-tab suspension
- Local Three.js runtime with no CDN or external textures

The renderer is adapted from Meng To / ThreeUI Community, pinned to commit `68802d5428071ada5c20db8094b1649e6bb770ed`. Its MIT notice is preserved in `LICENSE-ThreeUI.txt`. Changes are listed in `PORTFOLIO.md`. Three.js 0.149.0 is vendored with its MIT notice.

## What a reviewer can try

1. Open the page without starting 3D. Adjust light and rain; select one of three framings.
2. Follow the three lesson buttons: original (100%, no rain), atmosphere (130%, rain), final frame (temple).
3. Pause the rain or reset the source. The result bar shows every active setting.
4. Start optional 3D. Current settings transfer to it; return to 2D without losing them.
5. If WebGL fails, continue the exercise in 2D and use the visible lightweight retry.

## Verification boundary

- Node syntax, static local asset links and anchor targets checked by scripts/verify.mjs.
- Node host simulation checks the 2D lesson presets, reset, reduced motion, loading-state transfer, initial/late 3D failures, context loss and explicit return to 2D.
- Pure capability policy and scene assembly checks use mocked GPU and Canvas2D; they do not certify actual rendering.
- No real browser, mobile screenshot or WebGL runtime verification was available during this build.
- No performance, conversion, revenue or client-use results are claimed.

## Product scope

- The base temple world is by Meng To / ThreeUI Community (MIT), not an original Safonov model.
- New contribution: visual identity, responsive page, control API, lifecycle integration, interactive 2D illustration, teaching steps and documentation.
- WebGL is required only for the optional 3D environment. The 2D illustration remains fully interactive.
- The 2D example uses prepared SVG artwork with CSS brightness, framing and a rain layer; it does not reconstruct an image into 3D.
- Device FPS and real-browser rendering have not been measured in this environment.
