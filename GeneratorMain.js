/**
 * GeneratorMain — custom <particle-wrap> element with Shadow DOM.
 *
 * Declarative usage:
 *   <particle-wrap noise-type="perlin" glow="0.3" emission-radius="300" density="2000">
 *     <div>Your content here</div>
 *   </particle-wrap>
 *
 * Attributes map directly to config.json:
 *   noise-type   → noiseRegistry.active
 *   glow         → render.glowIntensity (0 = off)
 *   emission-radius → emission.radius
 *   density      → particleCount
 */
import { boot } from './System/Boot.js';
import { success, failure, dump } from './TraceLog.js';
import config from './config.json';

const ATTR_MAP = {
    'noise-type': (v) => { if (v) config.noiseRegistry.active = v; },
    'glow': (v) => { config.render.glowIntensity = parseFloat(v) || 0; },
    'emission-radius': (v) => { config.emission.radius = parseInt(v, 10) || config.emission.radius; },
    'density': (v) => { config.particleCount = parseInt(v, 10) || config.particleCount; },
};

class ParticleWrap extends HTMLElement {
    constructor() {
        super();
        this._gen = null;
        this._observer = null;
    }

    connectedCallback() {
        // Map attributes → config
        for (const [attr, apply] of Object.entries(ATTR_MAP)) {
            if (this.hasAttribute(attr)) apply(this.getAttribute(attr));
        }

        // Attach Shadow DOM — canvas goes in shadow, light DOM content remains visible
        const shadow = this.attachShadow({ mode: 'open' });

        // Observe light DOM children for color analysis
        this._observer = new MutationObserver(() => {
            if (this._gen) return;
            // Only fire once light DOM is fully rendered
            const lightChildren = this.children.length;
            if (lightChildren > 0) {
                this._observer.disconnect();
                this._init(shadow);
            }
        });

        // Check immediately if light DOM is ready
        if (this.children.length > 0) {
            this._init(shadow);
        } else {
            this._observer.observe(this, { childList: true, subtree: true });
        }
    }

    disconnectedCallback() {
        if (this._observer) this._observer.disconnect();
        if (this._gen) this._gen.destroy();
    }

    _init(shadow) {
        try {
            success('ParticleWrap', 'Mounting with Shadow DOM');

            // Boot uses this (the light DOM host element) for color analysis,
            // but the canvas is appended to the Shadow DOM via an internal mount point
            const mountEl = document.createElement('div');
            mountEl.style.position = 'relative';
            mountEl.style.width = '100%';
            mountEl.style.height = '100%';
            mountEl.style.minHeight = '100px';
            shadow.appendChild(mountEl);

            // We need boot to use mountEl for canvas, but this (host) for color analysis
            this._gen = boot(this, mountEl);
            if (this._gen) this._gen.start();
        } catch (err) {
            failure('ParticleWrap', 'Init failed', { error: err.message });
        }
    }
}

if (!customElements.get('particle-wrap')) {
    customElements.define('particle-wrap', ParticleWrap);
}

export { ParticleWrap };