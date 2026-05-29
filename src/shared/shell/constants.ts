export const ShellOpenFailureReason = {
  NotFound: 'not_found',
  PermissionDenied: 'permission_denied',
  OpenFailed: 'open_failed',
  Unknown: 'unknown',
} as const;

export type ShellOpenFailureReason =
  typeof ShellOpenFailureReason[keyof typeof ShellOpenFailureReason];

