import { defineHandler } from 'nitro/h3';
import service from '../../../server/services/telemetry-service.mjs';

export default defineHandler((event) => service(event.req));
