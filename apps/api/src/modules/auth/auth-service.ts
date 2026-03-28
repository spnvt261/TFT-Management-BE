import { AppError, badRequest } from "../../core/errors/app-error.js";
import { env } from "../../core/config/env.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { ADMIN_ROLE_CODE, USER_ROLE_CODE } from "./auth.constants.js";
import type { JwtService } from "./jwt.service.js";
import type { RoleCode } from "./auth.types.js";

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  role: RoleCode;
}

export class AuthService {
  public constructor(
    private readonly repositories: RepositoryBundle,
    private readonly jwtService: JwtService
  ) {}

  public async loginAsUser(): Promise<LoginResult> {
    return this.issueTokenForRole(USER_ROLE_CODE);
  }

  public async loginAsAdmin(accessCode: string): Promise<LoginResult> {
    const normalizedCode = accessCode.trim();
    if (normalizedCode.length === 0) {
      throw badRequest("AUTH_LOGIN_INVALID", "accessCode must not be empty");
    }

    if (normalizedCode !== env.auth.adminAccessCode) {
      throw new AppError(401, "AUTH_ACCESS_CODE_INVALID", "The provided access code is incorrect");
    }

    return this.issueTokenForRole(ADMIN_ROLE_CODE);
  }

  private async issueTokenForRole(roleCode: RoleCode): Promise<LoginResult> {
    const role = await this.repositories.roles.findByCode(roleCode);

    if (!role) {
      throw new AppError(500, "AUTH_ROLE_NOT_CONFIGURED", `Role ${roleCode} is not configured`);
    }

    return {
      accessToken: this.jwtService.issueAccessToken({
        roleId: role.id,
        roleCode
      }),
      tokenType: "Bearer",
      expiresIn: this.jwtService.expiresInSeconds,
      role: roleCode
    };
  }
}
