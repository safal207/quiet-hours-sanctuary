# Quiet Hours — portfolio case

## Problem

Make a visual idea tangible through a small interactive experience that can be explored without an account.

## Contribution

- Lazy WebGL loading with an original graphic prologue
- Three camera viewpoints, real rain/ripple visibility and exposure controls
- Pause, reduced-motion preference and background-tab suspension
- Local Three.js runtime with no CDN or external textures

The renderer is adapted from Meng To / ThreeUI Community, pinned to commit `68802d5428071ada5c20db8094b1649e6bb770ed`. Its MIT notice is preserved in `LICENSE-ThreeUI.txt`. Changes are listed in `PORTFOLIO.md`. Three.js 0.149.0 is vendored with its MIT notice.

## What a reviewer can try

1. Lazy WebGL loading with an original graphic prologue.
2. Three camera viewpoints, real rain/ripple visibility and exposure controls.
3. Pause, reduced-motion preference and background-tab suspension.
4. Local Three.js runtime with no CDN or external textures.

## Verification boundary

- Node syntax, static local asset links and anchor targets checked by scripts/verify.mjs.
- Room Control additionally checks persisted-state sanitization, preset isolation and watt estimates.
- Layer Lab additionally checks palette/export consistency and hidden-layer exclusion.
- No real browser, mobile screenshot or WebGL runtime verification was available during this build.
- No performance, conversion, revenue or client-use results are claimed.

## Product scope

- The base temple world is by Meng To / ThreeUI Community (MIT), not an original Safonov model.
- New contribution: visual identity, responsive page, control API, lifecycle integration, graphic prologue and documentation.
- WebGL is required for the scene. The graphic prologue remains available otherwise.
- Device FPS and real-browser rendering have not been measured in this environment.
