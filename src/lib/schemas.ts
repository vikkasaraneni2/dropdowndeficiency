import { z } from 'zod';

export const DecisionEnum = z.enum(['Yes', 'No', 'Other']);

export const CreateVisitSchema = z.object({
	siteName: z.string().min(1),
	address: z.string().min(1),
	verticals: z.array(z.string()).min(1),
	techUserId: z.string().min(1),
	visitNotes: z.string().default(''),
});

export const UpdateVisitSchema = z.object({
	visitNotes: z.string().optional(),
	verticals: z.array(z.string()).optional(),
});

export const CreateFindingSchema = z.object({
	visitId: z.string().uuid(),
	itemCode: z.string().min(1),
	decision: DecisionEnum,
	otherReason: z.string().nullable().optional(),
	quantity: z.number().nullable().optional(),
	unitPrice: z.union([z.number(), z.string()]).nullable().optional(),
	// For complex Yes items
	sendToQuote: z.boolean().optional(),
	notes: z.string().default(''),
	attachments: z.array(z.string().uuid()).default([]),
	extraPromptFields: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateFindingSchema = z.object({
	decision: DecisionEnum.optional(),
	otherReason: z.string().nullable().optional(),
	quantity: z.number().nullable().optional(),
	unitPrice: z.union([z.number(), z.string()]).nullable().optional(),
	sendToQuote: z.boolean().optional(),
	notes: z.string().optional(),
	attachments: z.array(z.string().uuid()).optional(),
	extraPromptFields: z.record(z.string(), z.unknown()).optional(),
});

export const AttachmentSchema = z.object({
	visitId: z.string().uuid(),
	findingId: z.string().uuid().nullable().optional(),
	fileName: z.string().min(1),
	mimeType: z.string().min(1),
	dataBase64: z.string().min(1),
	tags: z.array(z.enum(['Photo', 'IR', 'Torque', 'Nameplate', 'Doc', 'Other'])).default([]),
});

export const ReportRequestSchema = z.object({
	visitId: z.string().uuid(),
	includedFindingIds: z.array(z.string().uuid()).optional(),
});

export type CreateVisit = z.infer<typeof CreateVisitSchema>;
export type UpdateVisit = z.infer<typeof UpdateVisitSchema>;
export type CreateFinding = z.infer<typeof CreateFindingSchema>;
export type UpdateFinding = z.infer<typeof UpdateFindingSchema>;
export type AttachmentInput = z.infer<typeof AttachmentSchema>;
export type ReportRequest = z.infer<typeof ReportRequestSchema>;


