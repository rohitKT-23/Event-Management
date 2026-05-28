// Mirror of Prisma enums so the frontend can use them without
// importing @prisma/client. Keep these in lockstep with schema.prisma.

export const UserRole = {
  ADMIN: 'ADMIN',
  PHOTOGRAPHER: 'PHOTOGRAPHER',
  CLUB_MEMBER: 'CLUB_MEMBER',
  VIEWER: 'VIEWER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ClubRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type ClubRole = (typeof ClubRole)[keyof typeof ClubRole];

export const EventCategory = {
  PHOTOSHOOT: 'PHOTOSHOOT',
  WORKSHOP: 'WORKSHOP',
  TRIP: 'TRIP',
  COMPETITION: 'COMPETITION',
  CULTURAL_FEST: 'CULTURAL_FEST',
  PARTY: 'PARTY',
  OTHER: 'OTHER',
} as const;
export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

export const MediaType = {
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];

export const ModerationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ModerationStatus = (typeof ModerationStatus)[keyof typeof ModerationStatus];

export const UploadStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

export const SharePlatform = {
  LINK: 'LINK',
  INSTAGRAM: 'INSTAGRAM',
  TWITTER: 'TWITTER',
  WHATSAPP: 'WHATSAPP',
} as const;
export type SharePlatform = (typeof SharePlatform)[keyof typeof SharePlatform];

export const NotificationType = {
  LIKE: 'LIKE',
  COMMENT: 'COMMENT',
  TAG: 'TAG',
  SHARE: 'SHARE',
  MENTION: 'MENTION',
  UPLOAD: 'UPLOAD',
  FACE_MATCH: 'FACE_MATCH',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationEntityType = {
  MEDIA: 'MEDIA',
  EVENT: 'EVENT',
  ALBUM: 'ALBUM',
  COMMENT: 'COMMENT',
} as const;
export type NotificationEntityType =
  (typeof NotificationEntityType)[keyof typeof NotificationEntityType];

// Role hierarchy used by RBAC middleware. Higher number = more powerful.
export const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 1,
  CLUB_MEMBER: 2,
  PHOTOGRAPHER: 3,
  ADMIN: 4,
};
