import redis from 'redis';

export default function redisClient(redisClient, config) { // eslint-disable-line no-unused-vars
  var redisCacheClient;

  if (redisClient) {
    redisCacheClient = redisClient;
  } else {
    redisCacheClient = redis.createClient(config || this.get('redis'));

    redisCacheClient.on('error', (err) => {
      this.error && this.error((err && err.stack) || err);
    });
  }
  this.set('redisCacheClient', redisCacheClient);

  return this;
}
