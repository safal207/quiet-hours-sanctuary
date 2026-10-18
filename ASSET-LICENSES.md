# Asset licenses

## Included ThreeUI assets

The Community components include the ThreeUI-authored images, textures, and other scene assets required for their complete renderers. Those files are part of the MIT-licensed Community release.

The repository-authored `assets/preview.jpg` and `assets/preview.webm` document the public interface and are also included under MIT.

## Included third-party assets

- Fragment Mono, Instrument Serif, Newsreader, Lexend, and Onest font software: SIL Open Font License 1.1. Copyright notices and the license text are in `FONT-LICENSES.md`.
- Bundled Three.js runtime files: MIT License, with the upstream copyright and SPDX header retained in each file.

The public sync explicitly removes the SF Pro font files used by the private source snapshot and uses the system-font fallback instead.

## External catalog media

Catalog thumbnails and preview videos are loaded from `https://threeui.com`. They are not copied into this repository and are not covered by this repository's MIT license.

Some Community HTML scenes also reference open-source browser libraries from public CDNs and ThreeUI-managed public image/video endpoints. They require no account, token, or paid API. Those remote files are not redistributed by this repository.

No Pro or Beta component source or component-specific asset is included.

## Quiet Hours visitor preview

`dist/assets/scene-preview.png` is an actual frame rendered from this repository's licensed ThreeUI temple scene, captured in Chromium software WebGL (1200 × 800, low profile). It replaces the SVG prologue on the visitor entry page. It is a raster preview of the existing model, not a generated reconstruction or a separate student submission. The source scene and preserved MIT notices above continue to apply.
