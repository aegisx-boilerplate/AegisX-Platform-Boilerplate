// Fastify Database Plugin (Recommended)
export { default as databasePlugin } from './lib/fastify-database.plugin.js';
export type { DatabasePluginOptions } from './lib/fastify-database.plugin.js';

// Simple Database Setup
export * from './lib/database-setup.js';

// Migration system
export * from './lib/migration/index.js';

// Advanced features (if needed)
export * from './lib/core-database.js';
