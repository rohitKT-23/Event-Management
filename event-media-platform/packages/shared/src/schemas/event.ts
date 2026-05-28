import { z } from 'zod';
import { EventCategory } from '../enums.js';

export const createEventSchema = z.object({
  clubId: z.string().min(20),
  name: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  category: z.enum([
    EventCategory.PHOTOSHOOT,
    EventCategory.WORKSHOP,
    EventCategory.TRIP,
    EventCategory.COMPETITION,
    EventCategory.CULTURAL_FEST,
    EventCategory.PARTY,
    EventCategory.OTHER,
  ]),
  coverImageUrl: z.string().url().nullish(),
  date: z.coerce.date(),
  location: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial().omit({ clubId: true });

export const listEventsQuerySchema = z.object({
  clubId: z.string().optional(),
  category: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(20),
});
