import { z } from 'zod';
import { insertZoneSchema, insertEarningSchema, insertPoiSchema, zones, earnings, pois, recommendations } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  zones: {
    list: {
      method: 'GET' as const,
      path: '/api/zones' as const,
      responses: {
        200: z.array(z.custom<typeof zones.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/zones/:id' as const,
      responses: {
        200: z.custom<typeof zones.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/zones' as const,
      input: insertZoneSchema,
      responses: {
        201: z.custom<typeof zones.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/zones/:id' as const,
      input: insertZoneSchema.partial(),
      responses: {
        200: z.custom<typeof zones.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/zones/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  earnings: {
    list: {
      method: 'GET' as const,
      path: '/api/earnings' as const,
      responses: {
        200: z.array(z.custom<typeof earnings.$inferSelect>()),
      },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/earnings/upload' as const,
      // Input is multipart/form-data, handled manually on backend, but we describe response
      responses: {
        200: z.object({
          processed: z.number(),
          failed: z.number(),
          errors: z.array(z.string()).optional(),
        }),
        400: errorSchemas.validation,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/earnings/stats' as const,
      responses: {
        200: z.object({
          totalEarnings: z.number(),
          totalTrips: z.number(),
          averagePerTrip: z.number(),
          topZones: z.array(z.object({ name: z.string(), amount: z.number() })),
        }),
      },
    },
  },
  pois: {
    list: {
      method: 'GET' as const,
      path: '/api/pois' as const,
      responses: {
        200: z.array(z.custom<typeof pois.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/pois' as const,
      input: insertPoiSchema,
      responses: {
        201: z.custom<typeof pois.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  recommendations: {
    list: {
      method: 'GET' as const,
      path: '/api/recommendations' as const,
      responses: {
        200: z.array(z.custom<typeof recommendations.$inferSelect>()),
      },
    },
    generate: { // Admin or automated trigger to refresh recommendations
      method: 'POST' as const,
      path: '/api/recommendations/generate' as const,
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
      },
    },
  },
  map: {
    data: {
      method: 'GET' as const,
      path: '/api/map-data' as const,
      responses: {
        200: z.object({
          zones: z.array(z.custom<typeof zones.$inferSelect>()),
          pois: z.array(z.custom<typeof pois.$inferSelect>()),
          recommendations: z.array(z.custom<typeof recommendations.$inferSelect>()),
          heatmapPoints: z.array(z.object({ lat: z.number(), lng: z.number(), weight: z.number() })),
        }),
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export type InsertPoi = z.infer<typeof insertPoiSchema>;

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
