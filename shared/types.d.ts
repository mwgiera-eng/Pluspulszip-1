import { z } from 'zod';
import { insertPoiSchema } from './schema';

export type InsertPoi = z.infer<typeof insertPoiSchema>;
