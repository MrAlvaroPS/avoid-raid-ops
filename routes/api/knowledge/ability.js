import { defineHandler } from 'nitro/h3';
import service from '../../../server/services/ability-knowledge-service.mjs';

export default defineHandler(event=>service(event.req));
