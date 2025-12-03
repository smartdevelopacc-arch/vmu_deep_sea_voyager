// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'deep-sea-voyager',    // Single unified app
      script: 'dist/index.js',     // Path to main entry point
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};