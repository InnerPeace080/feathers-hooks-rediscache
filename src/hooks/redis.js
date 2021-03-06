import moment from 'moment';
import chalk from 'chalk';
import { parsePath } from './helpers/path';
import RedisCache from '../routes/helpers/redis';

const defaults = {};

export function before(options) { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-param-reassign
  options = Object.assign({}, defaults, options);

  return function (hook) {
    return new Promise((resolve) => {
      const client = hook.app.get('redisCacheClient');
      const cacheOptions = hook.app.get('redisCache');
      const env = cacheOptions.env || 'production';
      const path = parsePath(hook, cacheOptions);

      hook.pathForRedisCache = path;
      client.get(`cache:${path}`, (err, reply) => {
        if (err !== null) {
          resolve(hook);

          return;
        }
        if (reply) {
          const data = JSON.parse(reply);

          if (!data.cache) {
            resolve(hook);

            return;
          }
          const duration = moment(data.cache.expiresOn).format('DD MMMM YYYY - HH:mm:ss');

          hook.result = data;
          resolve(hook);

          /* istanbul ignore next */
          if (env !== 'production') {
            console.log(`${chalk.cyan('[redis]')} returning cached value for ${chalk.green(path)}.`);
            console.log(`> Expires on ${duration}.`);
          }
        } else {
          resolve(hook);

          return;
        }
      });
    });
  };
};

export function after(options) { // eslint-disable-line no-unused-vars
  // eslint-disable-next-line no-param-reassign
  options = Object.assign({}, defaults, options);

  return function (hook) {
    return new Promise((resolve) => {
      if ((!hook.result) || (!hook.result.cache) || (!hook.result.cache.cached)) {
        const cacheOptions = hook.app.get('redisCache');
        const env = cacheOptions.env || 'production';
        const cachingDefault = cacheOptions.defaultDuration ? cacheOptions.defaultDuration : 3600 * 24;
        const duration = (hook.result && hook.result.cache) ?
          hook.result.cache.duration : cachingDefault;
        const client = hook.app.get('redisCacheClient');
        const path = (hook.pathForRedisCache || parsePath(hook, cacheOptions));

        // adding a cache object
        hook.result = hook.result || {};
        hook.result.cache = Object.assign(hook.result.cache || {}, {
          cached: true,
          duration: duration,
          expiresOn: moment().add(moment.duration(duration, 'seconds')),
          parent: hook.path,
          group: hook.path ? `group-${hook.path}` : '',
          key: path
        });

        client.set(`cache:${path}`, JSON.stringify(hook.result));
        client.expire(`cache:${path}`, hook.result.cache.duration);
        if (hook.path) {
          client.rpush(`cache:${hook.result.cache.group}`, `cache:${path}`);
        }

        /* istanbul ignore next */
        if (env !== 'production') {
          console.log(`${chalk.cyan('[redis]')} added ${chalk.green(path)} to the cache.`);
          console.log(`> Expires in ${moment.duration(duration, 'seconds').humanize()}.`);
        }
      }

      if (hook.result && hook.result.cache && hook.result.cache.hasOwnProperty('wrapped')) {
        const { wrapped } = hook.result.cache;

        hook.result = wrapped;
      }

      resolve(hook);
    });
  };
};

export function clearGroup(target) { // eslint-disable-line no-unused-vars
  return function (hook) {
    let targetTemp = target || hook.path;

    if (targetTemp) {
      const client = hook.app.get('redisCacheClient');
      const h = new RedisCache(client);

      const cacheOptions = hook.app.get('redisCache');
      const env = cacheOptions.env || 'production';

      targetTemp = 'group-' + targetTemp;
      // Returns elements of the list associated to the target/key 0 being the
      // first and -1 specifying get all till the latest
      client.lrange(`cache:${targetTemp}`, 0, -1, (err, reply) => {
        if (err) {
          console.error({
            message: 'something went wrong' + err.message
          });
        } else {
          // If the list/group existed and contains something
          if (reply && Array.isArray(reply) && (reply.length > 0)) {
            // Clear existing cached group key
            h.clearGroup(`cache:${targetTemp}`).then((r) => {
              if (env !== 'production') {
                console.log({
                  message:
                    `cache cleared for the group key: ${targetTemp}`
                });
              }

              return;
            })
              .catch(()=>{});
          } else {
            /**
             * Empty reply means the key does not exist.
             * Must use HTTP_OK with express as HTTP's RFC stats 204 should not
             * provide a body, message would then be lost.
             */
            if (env !== 'production') {
              console.log({
                message:
                 `cache already cleared for the group key: ${targetTemp}`
              });
            }
          }
        }
      });
    }
  };
};
