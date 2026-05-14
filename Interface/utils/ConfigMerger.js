/**
 * Interface/utils/ConfigMerger.js — attribute ↔ config bridging utilities.
 * Extracted from ParticleWrap to keep the Custom Element class declarative.
 */

/**
 * Deep-clone baseConfig and override with any HTML attributes present on element.
 * @param {Object} baseConfig
 * @param {HTMLElement} element
 * @returns {Object} merged instance config
 */
export const mergeAttrConfig = (baseConfig, element) => {
    const cfg = structuredClone(baseConfig);
    if (element.hasAttribute('noise-type'))
        cfg.noiseRegistry.active = element.getAttribute('noise-type');
    if (element.hasAttribute('glow'))
        cfg.render.glowIntensity = parseFloat(element.getAttribute('glow')) || 0;
    if (element.hasAttribute('emission-radius'))
        cfg.emission.radius = parseInt(element.getAttribute('emission-radius'), 10) || cfg.emission.radius;
    if (element.hasAttribute('density'))
        cfg.particleCount = parseInt(element.getAttribute('density'), 10) || cfg.particleCount;
    return cfg;
};

/**
 * Dispatch a live attribute change to the running boot controller.
 * @param {{ configure: Function }} gen
 * @param {string} name — attribute name
 * @param {string} val  — new value
 * @param {Object} cfg  — current instance config (for defaults)
 */
export const applyAttrPatch = (gen, name, val, cfg) => {
    switch (name) {
        case 'glow':
            gen.configure({ render: { glowIntensity: parseFloat(val) || 0 } }); break;
        case 'emission-radius':
            gen.configure({ emission: { radius: parseInt(val, 10) || cfg.emission?.radius } }); break;
        case 'noise-type':
            gen.configure({ noiseType: val }); break;
        case 'density':
            gen.configure({ particleCount: parseInt(val, 10) || cfg.particleCount }); break;
    }
};
