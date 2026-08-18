import { defineHandler } from 'nitro/h3';
import service from '../../../server/services/official-encounter-knowledge-service.mjs';

export default defineHandler(event=>service(event.req));
