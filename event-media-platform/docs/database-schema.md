# Database schema

PostgreSQL via Prisma ORM. Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).
All ids are `cuid()`. Foreign keys and common query columns are indexed.

## Enums

| Enum                     | Values                                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| `UserRole`               | ADMIN, PHOTOGRAPHER, CLUB_MEMBER, VIEWER                                 |
| `ClubRole`               | ADMIN, MEMBER                                                           |
| `EventCategory`          | PHOTOSHOOT, WORKSHOP, TRIP, COMPETITION, CULTURAL_FEST, PARTY, OTHER     |
| `MediaType`              | PHOTO, VIDEO                                                            |
| `ModerationStatus`       | PENDING, APPROVED, REJECTED                                             |
| `UploadStatus`           | PENDING, PROCESSING, DONE, FAILED                                      |
| `SharePlatform`          | LINK, INSTAGRAM, TWITTER, WHATSAPP                                      |
| `NotificationType`       | LIKE, COMMENT, TAG, SHARE, MENTION, UPLOAD, FACE_MATCH                  |
| `NotificationEntityType` | MEDIA, EVENT, ALBUM, COMMENT                                            |

## Tables

| Table                | Purpose                          | Key columns                                                                                  |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `User`               | Accounts & roles                 | username (unique), email (unique), passwordHash, role, avatarUrl, bio, googleId, faceEmbeddingId, isVerified |
| `RefreshToken`       | JWT refresh rotation             | userId, tokenHash (unique), expiresAt, revokedAt                                             |
| `PasswordReset`      | Forgot-password tokens           | userId, tokenHash (unique), expiresAt, usedAt                                                |
| `Club`               | Photography clubs                | name (unique), slug (unique), logoUrl, createdById                                          |
| `ClubMembership`     | Club members + roles             | clubId, userId, role; unique (clubId,userId)                                                 |
| `Event`              | Events under a club              | clubId, name, slug (unique), category, coverImageUrl, date, location, isPublic, createdById |
| `Album`              | Albums under an event            | eventId, name, description, isPublic, createdById                                            |
| `AlbumCollaborator`  | Album upload collaborators       | albumId, userId; unique (albumId,userId)                                                     |
| `Media`              | Photos & videos                  | uploaderId, albumId?, eventId?, s3Key (unique), type, mimeType, fileSize, width/height, aiTags (GIN), aiCaption, phash, exif, gpsLat/Lng, moderationStatus, uploadStatus, thumbnailUrl, cdnUrl, watermarkUrl |
| `FaceIndex`          | Rekognition faces per media      | mediaId, userId?, rekognitionFaceId, boundingBox, confidence                                |
| `UserSelfie`         | Reference selfies for matching   | userId, selfieUrl, rekognitionFaceId (unique)                                               |
| `Like`               | Media likes                      | userId, mediaId; unique (userId,mediaId)                                                      |
| `Comment`            | Threaded comments                | userId, mediaId, parentId?, content, isDeleted                                              |
| `Share`              | Share events                     | userId, mediaId, platform                                                                    |
| `Favourite`          | User favourites                  | userId, mediaId; unique (userId,mediaId)                                                      |
| `MediaTag`           | People tagged on a photo         | mediaId, taggedUserId, taggedById, xPercent, yPercent; unique (mediaId,taggedUserId)         |
| `Download`           | Watermarked download log         | userId, mediaId, watermarkedUrl, bytesServed, downloadedAt                                   |
| `Notification`       | In-app notifications             | recipientId, actorId?, type, entityType, entityId, message, payload, isRead                  |
| `MediaView`          | Media view analytics             | mediaId, viewerId?, ipHash, viewedAt                                                          |
| `EventView`          | Event view analytics             | eventId, viewerId?, ipHash, viewedAt                                                          |
| `EventAttendance`    | RSVP / attendance                | eventId, userId; unique (eventId,userId)                                                      |

## Notable relationships

- `User` 1—N `Media`, `Like`, `Comment`, `Favourite`, `Download`, `ClubMembership`.
- `Club` 1—N `Event`; `Event` 1—N `Album`; `Album` 1—N `Media`.
- `Media` 1—N `FaceIndex`, `Like`, `Comment`, `MediaTag`, `Download`, `MediaView`.
- `Media.aiTags` uses a GIN index for fast tag search; `Media.phash` is indexed for duplicate detection.
