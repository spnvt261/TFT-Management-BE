export const roleCodeValues = ["ADMIN", "USER"] as const;
export type RoleCode = (typeof roleCodeValues)[number];

export interface AuthenticatedUser {
  roleId: string;
  roleCode: RoleCode;
}

export interface JwtAccessPayload extends AuthenticatedUser {
  iat: number;
  exp: number;
}
