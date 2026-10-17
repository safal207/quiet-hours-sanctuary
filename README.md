# Quiet Hours

An atmospheric temple experience built around the free ThreeUI Community scene.

Ночной сад: три точки обзора, управление дождём и светом, пауза и запуск 3D по желанию посетителя.

![Original graphic prologue — the live 3D temple is a separate licensed scene](dist/assets/sanctuary.svg)

*Original graphic prologue — the live 3D temple is a separate licensed scene.*

## Explore

- [Public demo](https://safal207.github.io/quiet-hours-sanctuary/)
- [Portfolio and learning paths](https://safal207.github.io/test-it-python/ai-path/)
- [Scope, contribution and evidence](PORTFOLIO.md)

## Features

- Lazy WebGL loading with an original graphic prologue
- Three camera viewpoints, real rain/ripple visibility and exposure controls
- Pause, reduced-motion preference and background-tab suspension
- Local Three.js runtime with no CDN or external textures

## Run locally

No package installation, API keys or CDN are required. Serve the static directory:

```bash
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Opening index.html directly as file:// is not supported because the application uses browser modules.

## Validate

```bash
npm run check
```

Checks cover local links, unique HTML IDs, JavaScript syntax and relevant state/export contracts. This is not a browser-rendering certification.

## Scope and limitations

- The base temple world is by Meng To / ThreeUI Community (MIT), not an original Safonov model.
- New contribution: visual identity, responsive page, control API, lifecycle integration, graphic prologue and documentation.
- WebGL is required for the scene. The graphic prologue remains available otherwise.
- Device FPS and real-browser rendering have not been measured in this environment.

## Credits and licensing

The renderer is adapted from Meng To / ThreeUI Community, pinned to commit `68802d5428071ada5c20db8094b1649e6bb770ed`. Its MIT notice is preserved in `LICENSE-ThreeUI.txt`. Changes are listed in `PORTFOLIO.md`. Three.js 0.149.0 is vendored with its MIT notice.

Creative direction and implementation: Alexey Safonov, with AI assistance. Code under MIT; preserve all third-party notices. Inspiration: the supplied Meng To visual references. No commercial relationship or endorsement is implied.

## Startup and mobile recovery

Low/touch mode skips HDR bloom. Desktop bloom is gated by half-float render-target support. The canvas stays hidden until a successful first frame, and both initial and later render failures return to a working Retry action. An explicit lightweight start is available. CSS owns canvas dimensions so orientation changes can resize the drawing buffer.

`npm run check` now exercises startup/retry/context loss with a mocked host, GPU capability policy, and real Three scene assembly with mocked drawing. These are regression checks, not real-device GPU or visual certification.
