/**
 * Distribution/ColorAnalyzer — one-time DOM color distribution analysis.
 *
 * Samples computed styles from a mounted DOM subtree,
 * builds a frequency-ranked color distribution,
 * and produces a weighted palette for particle color assignment.
 */
const extract = (root) => {
    const els = root.querySelectorAll('*');
    const colors = [];
    for (let i = 0; i < els.length; i++) {
        const s = getComputedStyle(els[i]);
        [s.color, s.backgroundColor, s.borderColor,
        s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor]
            .forEach((c) => { if (c && c.startsWith('rgb')) colors.push(c); });
    }
    return colors;
};

const normalize = (c) => c.toLowerCase().replace(/\s+/g, '');

const count = (colors) =>
    colors.reduce((m, c) => m.set(normalize(c), (m.get(normalize(c)) || 0) + 1), new Map());

const toHex = (rgb) => {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return rgb;
    return '#' + [m[1], m[2], m[3]].map((v) => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
};

const rank = (freqMap, total) => {
    if (total === 0) return [];
    let cum = 0;
    return [...freqMap.entries()]
        .map(([rgb, count]) => ({ hex: toHex(rgb), rgb, count, pct: count / total }))
        .sort((a, b) => b.pct - a.pct)
        .map((e, i) => ({ ...e, rank: i + 1, cumPct: (cum += e.pct) }));
};

/**
 * Sample colors from a DOM subtree, returning ranked distribution.
 * Pure function — no side effects.
 * @param {HTMLElement} rootEl
 * @returns {Array<{hex:string, pct:number, rank:number, cumPct:number}>}
 */
const sample = (rootEl) => {
    const raw = extract(rootEl);
    return rank(count(raw), raw.length);
};

/**
 * Build a weighted palette array for O(1) random color picks.
 * Pre-sizes the output array to avoid repeated spread allocations (was O(N²)).
 * @param {Array<{hex:string, count:number}>} dist
 * @returns {string[]}
 */
const weightedPalette = (dist) => {
    let total = 0;
    for (let i = 0; i < dist.length; i++) total += dist[i].count;
    const out = new Array(total);
    let idx = 0;
    for (let i = 0; i < dist.length; i++) {
        const { hex, count } = dist[i];
        for (let j = 0; j < count; j++) out[idx++] = hex;
    }
    return out;
};

export { sample, weightedPalette };