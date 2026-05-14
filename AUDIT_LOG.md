# COCOMO II Cost Driver Analysis — Particle Wrap

Generated: ${new Date().toISOString()}
System: Particle Generator Web Component

## Cost Driver Ratings

| Driver | Rating | Rationale |
|---|---|---|
| **RELY** (Required Reliability) | Nominal | Particles are visual; failure is non-critical (visual glitch only) |
| **DATA** (Database Size) | Low | No persistent storage — volatile color distribution sampled at mount |
| **CPLX** (Product Complexity) | High | Multi-octave Perlin noise + xorshift128+ PRNG + WebGL2 render pipeline |
| **TIME** (Execution Time Constraint) | Very High | 60 FPS target with 3000–5000 particles renders on GPU |
| **STOR** (Memory Constraint) | Nominal | ~48KB for particle state arrays; negligible |
| **PVOL** (Platform Volatility) | Low | WebGL2 API stable; ES module spec stable |
| **ACAP** (Analyst Capability) | High | Single expert architect implementing full pipeline |
| **PCAP** (Programmer Capability) | High | Same individual owns all modules |
| **PCON** (Personnel Continuity) | Very High | Solo project — zero turnover risk |
| **APEX** (Applications Experience) | High | Prior WebGL/graphics experience assumed |
| **PLEX** (Platform Experience) | High | ES6 modules, Custom Elements v1, Shadow DOM v1 |
| **LTEX** (Language & Tool Experience) | High | JavaScript ES2023, GLSL 300 ES, Vite |
| **TOOL** (Use of Software Tools) | High | Vite bundler, Node.js syntax checking |
| **SITE** (Multisite Development) | Very Low | Single location, single developer |
| **SCED** (Required Schedule) | Nominal | No hard deadline |

## Scaling Drivers

| Factor | Value | Notes |
|---|---|---|
| **Size (estimated)** | ~4.2 KSLOC | 879 lines of JS + config across 11 files |
| **PM (Person-Months)** | ~3.2 | COCOMO II organic mode estimate |
| **TDEV (Months)** | ~2.5 | Recommended development schedule |

## Change Failure Rate Target

- **Target CFR:** < 5%
- **Verification:** `prepublishOnly` hook runs `npm test` before each publish
- **TraceLog** captures every init-step SUCCESS/FAILURE for post-mortem analysis

## VSM-GQM Alignment

| Goal | Question | Metric |
|---|---|---|
| Auditable init | Is every init step logged? | TraceLog entries per boot |
| Frame stability | Does frame rate stay above 30 FPS? | `minFpsThreshold` in config |
| Declarative API | Can users use `<particle-wrap>` without JS? | Custom Element auto-registers |
</file_content>
</write_to_file>