# Particle Wrap

**WebGL2 particle generator web component** — wrap any HTML content with a particle field that samples the DOM's colors.

```
<particle-wrap noise-type="perlin" glow="0.25" emission-radius="280" density="2500">
  <div>Your content here — its colors become the particles</div>
</particle-wrap>
```

## Features

- **Custom Element** — `<particle-wrap>` with Shadow DOM, zero boilerplate
- **Color sampling** — extracts hex/RGB distribution from light DOM children, uses them as weighted particle palette
- **Noise-driven motion** — Perlin noise (fluid flow) + White noise (Brownian jitter) via `xorshift128+`
- **Glow effect** — distance-based fragment shader halo (`glow` attribute)
- **Vignette alpha** — particles fade as they move away from the emission center
- **TypedArray pipeline** — `Float32Array` flat buffer, single GPU draw call per shape batch
- **Auditable** — every init step logged to `TraceLog` ring buffer

---

## Import & Use

### Option 1: Custom Element (declarative, recommended)

```html
<script type="module">
  import 'particle-wrap';
</script>

<particle-wrap noise-type="perlin" glow="0.3" emission-radius="300" density="2000">
  <div style="color: #c4a87c;">
    <h1>Hello World</h1>
  </div>
</particle-wrap>
```

Particles auto-start. No JavaScript needed beyond the import.

### Option 2: NPM package

```bash
npm install particle-wrap
```

```js
// ESM
import 'particle-wrap/GeneratorMain.js';

// UMD (from dist/)
import { createGenerator } from 'particle-wrap';
```

### Option 3: Programmatic API

```js
import { createGenerator } from './GeneratorMain.js';

const gen = createGenerator(
  document.getElementById('target'),  // light DOM for color analysis
  document.getElementById('mount')    // Shadow DOM mount point (optional)
);
gen.start();   // begin render loop
// gen.stop();    // pause
// gen.destroy(); // full teardown + GPU resource release
```

---

## Attributes

| Attribute          | Type    | Default  | Maps to config.json         |
|--------------------|---------|----------|-----------------------------|
| `noise-type`       | string  | `perlin` | `noiseRegistry.active`      |
| `glow`             | float   | `0.15`   | `render.glowIntensity`      |
| `emission-radius`  | int     | `250`    | `emission.radius`           |
| `density`          | int     | `3000`   | `particleCount`             |

## Noise Types

| Name     | Effect                          |
|----------|----------------------------------|
| `perlin` | Smooth fluid flow (multi-octave) |
| `white`  | Chaotic Brownian jitter          |

Configure parameters in `config.json` under `noiseRegistry.providers`.

---

## Project Structure

```
ParticleGenerator/
├── GeneratorMain.js        — Custom Element + programmatic entry point
├── Core/
│   ├── ParticleSystem.js   — typed-array state, noise mixing, vignette, culling
│   └── WebGLRenderer.js    — owns ALL WebGL state, glow uniform, draw()
├── GenerationAlgorithms/
│   ├── PerlinNoise.js      — 2D gradient noise, fBm, normalized [0,1]
│   └── WhiteNoise.js       — xorshift128+ PRNG, coordinate-seeded jitter
├── Distribution/
│   └── ColorAnalyzer.js    — DOM color frequency → weighted palette
├── Particle/
│   └── ShapeFactory.js     — circle/triangle/square pure geometry
├── GL/Shaders.js           — GLSL 300 ES with glow
├── System/Boot.js          — wires everything together
├── config.json             — defaults for all parameters
├── index.html              — interactive demo with live sliders
├── package.json            — Vite build, UMD/ESM, prepublishOnly
├── vite.config.js          — library mode bundler config
├── AUDIT_LOG.md            — COCOMO II cost drivers
└── TraceLog.js             — internal audit ring buffer
```

## Development

```bash
npm install
npm run dev     # Vite dev server with HMR
npm run build   # → dist/particle-wrap.esm.js + .umd.js
npm run preview # preview the build
```

## Build Output

```
dist/
├── particle-wrap.esm.js   # ES module (import)
└── particle-wrap.umd.js   # Universal (script tag / require)
```

## Tech Stack

- WebGL2 (GLSL 300 ES)
- Custom Elements v1 + Shadow DOM v1
- ES6 Modules
- Vite (build)
- xorshift128+ (PRNG)
- Perlin gradient noise (2D, multi-octave fBm)