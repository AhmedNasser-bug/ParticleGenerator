/**
 * Interface/ParticleWrap.js — INTERFACE TIER. Custom Element definition.
 *
 * Declarative usage:
 *   <particle-wrap noise-type="perlin" glow="0.3" emission-radius="300" density="2000">
 *     <div>Content — its colors become the particles</div>
 *   </particle-wrap>
 *
 * Registered via GeneratorMain.js:
 *   ParticleWrap.define('particle-wrap', config);
 *
 * Live attributes:
 *   noise-type      → hot-swap noise algorithm (no restart)
 *   glow            → hot-patch render config
 *   emission-radius → hot-patch emission zone
 *   density         → lightweight ParticleSystem rebuild
 */
import { boot } from './Boot.js';
import { success, failure } from '../TraceLog.js';

const OBSERVED = ['noise-type', 'glow', 'emission-radius', 'density'];

class ParticleWrap extends HTMLElement {
    /** Call once to register the custom element. */
    static define(tag = 'particle-wrap', defaultConfig = {}) {
        ParticleWrap._defaultConfig = defaultConfig;
        if (!customElements.get(tag)) {
            customElements.define(tag, ParticleWrap);
        }
    }

    static _defaultConfig = {};
    static get observedAttributes() { return OBSERVED; }

    constructor() {
        super();
        this._gen      = null;
        this._observer = null;
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        this._observer = new MutationObserver(() => {
            if (this._gen || this.children.length === 0) return;
            this._observer.disconnect();
            this._init(shadow);
        });
        if (this.children.length > 0) {
            this._init(shadow);
        } else {
            this._observer.observe(this, { childList: true, subtree: true });
        }
    }

    disconnectedCallback() {
        this._observer?.disconnect();
        this._gen?.destroy();
        this._gen = null;
    }

    attributeChangedCallback(name, _old, val) {
        if (!this._gen) return;
        const cfg = ParticleWrap._defaultConfig;
        switch (name) {
            case 'glow':
                this._gen.configure({ render: { glowIntensity: parseFloat(val) || 0 } });
                break;
            case 'emission-radius':
                this._gen.configure({ emission: { radius: parseInt(val, 10) || cfg.emission?.radius } });
                break;
            case 'noise-type':
                this._gen.configure({ noiseType: val });
                break;
            case 'density':
                this._gen.configure({ particleCount: parseInt(val, 10) || cfg.particleCount });
                break;
        }
    }

    _init(shadow) {
        // Merge defaults with element attributes into a per-instance config
        const cfg = structuredClone(ParticleWrap._defaultConfig);
        if (this.hasAttribute('noise-type'))      cfg.noiseRegistry.active  = this.getAttribute('noise-type');
        if (this.hasAttribute('glow'))            cfg.render.glowIntensity  = parseFloat(this.getAttribute('glow')) || 0;
        if (this.hasAttribute('emission-radius')) cfg.emission.radius       = parseInt(this.getAttribute('emission-radius'), 10) || cfg.emission.radius;
        if (this.hasAttribute('density'))         cfg.particleCount         = parseInt(this.getAttribute('density'), 10) || cfg.particleCount;

        try {
            success('ParticleWrap', 'Mounting');
            const mountEl = document.createElement('div');
            mountEl.style.cssText = 'position:relative;width:100%;height:100%;min-height:100px';
            shadow.appendChild(mountEl);
            this._gen = boot(this, mountEl, cfg);
            this._gen?.start();
        } catch (err) {
            failure('ParticleWrap', 'Init failed', { error: err.message });
        }
    }
}

export { ParticleWrap };
