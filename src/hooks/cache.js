/**
 * After hook - generates a cache object that is needed
 * for the redis hook and the express middelware.
 * @todo add default value in config file
 */
const defaults = {};

export function cache(options) { // eslint-disable-line no-unused-vars
  options = Object.assign({}, defaults, options); // eslint-disable-line no-param-reassign

  return function (hook) {
    if (hook.result && !hook.result.hasOwnProperty('cache')) {
      let cache = {};

      if (Array.isArray(hook.result)) {
        const array = hook.result;

        cache.wrapped = array;
        hook.result = {};
      }

      cache = Object.assign({}, cache, {
        // cached: false,
        duration: options.duration || 3600 * 24
      });

      hook.result.cache = cache;
    }

    return Promise.resolve(hook);
  };
};

export function removeCacheInformation(options) { // eslint-disable-line no-unused-vars
  options = Object.assign({}, defaults, options); // eslint-disable-line no-param-reassign

  return function (hook) {
    if (hook.result && hook.result.hasOwnProperty('cache')) {
      delete hook.result.cache;
    }

    return Promise.resolve(hook);
  };
};
