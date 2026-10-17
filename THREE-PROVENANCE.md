# Three.js r149 local runtime

Source: https://github.com/mrdoob/three.js/blob/4503ef10b81a00f5c6c64fe9a856881ee31fe6a3/build/three.module.js

- Official annotated tag: r149
- Tag object: 5181989615b970c3c0717a76f03a56814245ab71
- Resolved commit: 4503ef10b81a00f5c6c64fe9a856881ee31fe6a3
- package.json at this commit explicitly verifies version 0.149.0 and module ./build/three.module.js.
- License: MIT, Copyright 2010-2023 Three.js Authors; exact official license is LICENSE-Three.txt.

| Local file | UTF-8 bytes | Git blob SHA | SHA-256 |
|---|---:|---|---|
| three.module.js | 1172521 | b2cf8fed47633d549827f44b8147dc1bf11fc9c6 | 450d60513f2a2148c9648d89418c5507908455458b191747be2492262791693c |
| LICENSE-Three.txt | 1081 | d07e209686512b9ac93d7df5481a4a6f622093e7 | 852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d |

Both downloaded files match upstream git blob hashes exactly. JavaScript syntax checked with Node module parser. Module is self-contained and has no static imports. Keep its original license header.

In the application, resolve the renderer's bare import "three" through an import map to the local module or change only that import to a local path. No CDN required.
