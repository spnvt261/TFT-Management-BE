import { AppError, badRequest } from "../../core/errors/app-error.js";
import type { RepositoryBundle } from "../../db/repositories/repository-factory.js";
import { ADMIN_ACCESS_CODE, ADMIN_ROLE_CODE, USER_ROLE_CODE } from "./auth.constants.js";
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

  public async login(accessCode: string): Promise<LoginResult> {
    const normalizedCode = accessCode.trim();
    if (normalizedCode.length === 0) {
      throw badRequest("AUTH_LOGIN_INVALID", "accessCode must not be empty");
    }

    const roleCode: RoleCode = normalizedCode === ADMIN_ACCESS_CODE ? ADMIN_ROLE_CODE : USER_ROLE_CODE;
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
