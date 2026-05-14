/**
 * GeneratorMain.js — package entry point.
 *
 * This file is intentionally declarative: it reads configuration and
 * registers the custom element. All imperative logic lives in the
 * three-tier architecture below it.
 *
 *   Interface tier : Interface/ParticleWrap.js  (Custom Element)
 *   Logic tier     : Core/ParticleSystem.js     (SAB physics)
 *   Core tier      : Core/Renderer.js           (all WebGL)
 */
import config from './config.json';
import { ParticleWrap } from './Interface/ParticleWrap.js';

ParticleWrap.define('particle-wrap', config);

export { ParticleWrap };