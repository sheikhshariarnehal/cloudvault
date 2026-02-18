module.exports = {
  apps: [
    {
      name: "cloudvault-backend",
      script: "dist/index.js",
      instances: 1, // GramJS client is stateful — do NOT use cluster mode
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
