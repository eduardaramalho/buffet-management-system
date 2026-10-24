import { z } from "zod";
import { eventTypes } from "../../domain/event.types.js";

export const dateSchema = z.coerce.date();

// Base without defaults: Zod 4's .partial() keeps .default(), which would overwrite omitted fields on PUT.
export const eventBaseSchema = z.object({
  name: z.string().min(3).max(150),
  eventDate: dateSchema,
  endDate: dateSchema.nullable().optional(),
  location: z.string().min(1).max(200),
  serviceType: z.enum(eventTypes),
  guestsCount: z.number().int().min(1).max(5000),
  observations: z.string().max(2000).nullable().optional(),
  clientId: z.string().min(1).max(36),
});

// Shared by POST /events and POST /events/:id/replicate (RF25), so both accept exactly the same event data.
export const createEventSchema = eventBaseSchema.extend({
  endDate: eventBaseSchema.shape.endDate.default(null),
  observations: eventBaseSchema.shape.observations.default(null),
});
