/** Interface/Element/ParticleWrap.js — INTERFACE TIER. Custom Element. */
import { boot }                          from '../Orchestration/Boot.js';
import { success, failure }              from '../../TraceLog.js';
import { mergeAttrConfig, applyAttrPatch } from '../utils/ConfigMerger.js';

const OBSERVED = ['noise-type', 'glow', 'emission-radius', 'density'];

class ParticleWrap extends HTMLElement {
    static define(tag = 'particle-wrap', defaultConfig = {}) {
        ParticleWrap._defaultConfig = defaultConfig;
        if (!customElements.get(tag)) customElements.define(tag, ParticleWrap);
    }
    static _defaultConfig = {};
    static get observedAttributes() { return OBSERVED; }

    constructor() { super(); this._gen = null; this._observer = null; }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        this._observer = new MutationObserver(() => {
            if (this._gen || this.children.length === 0) return;
            this._observer.disconnect(); this._init(shadow);
        });
        if (this.children.length > 0) this._init(shadow);
        else this._observer.observe(this, { childList: true, subtree: true });
    }

    disconnectedCallback() { this._observer?.disconnect(); this._gen?.destroy(); this._gen = null; }

    attributeChangedCallback(name, _old, val) {
        if (!this._gen) return;
        applyAttrPatch(this._gen, name, val, ParticleWrap._defaultConfig);
    }

    _init(shadow) {
        const cfg = mergeAttrConfig(ParticleWrap._defaultConfig, this);
        try {
            success('ParticleWrap', 'Mounting');
            const mountEl = document.createElement('div');
            mountEl.style.cssText = 'position:relative;width:100%;height:100%;min-height:100px';
            shadow.appendChild(mountEl);
            this._gen = boot(this, mountEl, cfg);
            this._gen?.start();
        } catch (err) { failure('ParticleWrap', 'Init failed', { error: err.message }); }
    }
}

export { ParticleWrap };
