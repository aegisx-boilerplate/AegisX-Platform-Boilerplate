import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { coreLogger } from '@aegisx/core-logger';
import { coreAuth } from '@aegisx/core-auth';
import { coreConfig } from '@aegisx/core-config';
import { coreDatabase } from '@aegisx/core-database';
import { coreErrors } from '@aegisx/core-errors';
import { coreRbac } from '@aegisx/core-rbac';

/* eslint-disable-next-line */
export interface AppOptions { }

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Place here your custom code!
  console.log('=== Testing All Core Libraries ===');
  console.log('coreLogger:', coreLogger());
  console.log('coreAuth:', coreAuth());
  console.log('coreConfig:', coreConfig());
  console.log('coreDatabase:', coreDatabase());
  console.log('coreErrors:', coreErrors());
  console.log('coreRbac:', coreRbac());
  console.log('=== All Core Libraries Working! ===');

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
