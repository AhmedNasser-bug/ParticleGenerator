/**
 * TraceLog — internal auditable trace logging system.
 * Adheres to VSM-GQM-DevOps principles: every initialization step
 * records success/failure state to a hidden internal log.
 *
 * Never exposed to runtime output. Memory-only ring buffer.
 */
const TRACE_LOG = [];
const MAX_ENTRIES = 500;

/**
 * @typedef {Object} TraceEntry
 * @property {string} timestamp
 * @property {string} module
 * @property {'SUCCESS'|'FAILURE'} status
 * @property {string} message
 * @property {Object|undefined} [meta]
 */

/**
 * Append a trace entry.
 * @param {string} module
 * @param {'SUCCESS'|'FAILURE'} status
 * @param {string} message
 * @param {Object} [meta]
 */
const log = (module, status, message, meta) => {
    const entry = {
        timestamp: new Date().toISOString(),
        module,
        status,
        message,
        ...(meta ? { meta } : {}),
    };
    TRACE_LOG.push(entry);
    if (TRACE_LOG.length > MAX_ENTRIES) {
        TRACE_LOG.shift();
    }
};

/**
 * Retrieve all trace entries (shallow copy).
 * @returns {TraceEntry[]}
 */
const dump = () => [...TRACE_LOG];

/**
 * Retrieve entries filtered by module.
 * @param {string} moduleName
 * @returns {TraceEntry[]}
 */
const filterByModule = (moduleName) =>
    TRACE_LOG.filter((e) => e.module === moduleName);

/**
 * Retrieve the most recent N entries.
 * @param {number} n
 * @returns {TraceEntry[]}
 */
const tail = (n) => TRACE_LOG.slice(-n);

/**
 * Create a success entry.
 * @param {string} module
 * @param {string} message
 * @param {Object} [meta]
 */
const success = (module, message, meta) =>
    log(module, 'SUCCESS', message, meta);

/**
 * Create a failure entry.
 * @param {string} module
 * @param {string} message
 * @param {Object} [meta]
 */
const failure = (module, message, meta) =>
    log(module, 'FAILURE', message, meta);

/**
 * Clear all entries (test support).
 */
const clear = () => {
    TRACE_LOG.length = 0;
};

export { success, failure, log, dump, filterByModule, tail, clear };