import { defineHandler } from 'nitro/h3';
import service from '../../../server/services/live-status-service.mjs';

export default defineHandler((event) => service(event.req));
