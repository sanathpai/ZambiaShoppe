module.exports = {
    globDirectory: 'build/',
    globPatterns: [
      '**/*.{html,js,css,png,jpg,svg,ico}'
    ],
    swDest: 'build/sw.js',
    runtimeCaching: [{
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
      },
    }, {
      urlPattern: new RegExp('^https://localhost:3000/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    }],
  };
  