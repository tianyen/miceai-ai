/**
 * Auto-bind all methods of a class instance
 *
 * Solves the issue where `this` context is lost when
 * class methods are passed as callbacks to Express routes.
 *
 * @param {Object} instance - The class instance to bind
 * @returns {Object} - The same instance with all methods bound
 */
function autoBind(instance) {
    const prototype = Object.getPrototypeOf(instance);
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const name of propertyNames) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);

        // Skip constructor and non-function properties
        if (name === 'constructor' || typeof descriptor.value !== 'function') {
            continue;
        }

        // Bind the method to the instance
        instance[name] = instance[name].bind(instance);
    }

    return instance;
}

module.exports = autoBind;
