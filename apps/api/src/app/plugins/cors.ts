import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import { config } from '@aegisx/core-config';

/**
 * CORS Plugin สำหรับ AegisX Platform API
 *
 * Plugin นี้จะติดตั้ง @fastify/cors เพื่อจัดการ Cross-Origin Resource Sharing
 *
 * Features:
 * - รองรับการตั้งค่า origin และ credentials จาก config
 * - ปรับแต่งได้ตาม environment
 */
export default fp(
  async function corsPlugin(fastify: FastifyInstance) {
    const appConfig = config.get('app');

    await fastify.register(cors, {
      origin: appConfig.cors.origin,
      credentials: appConfig.cors.credentials,
    });

    fastify.log.info('✅ CORS enabled', {
      origin: appConfig.cors.origin,
      credentials: appConfig.cors.credentials,
    });
  },
  {
    name: 'cors-plugin',
    dependencies: [],
  }
);
