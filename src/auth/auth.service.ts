import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { roleFromDb } from '../common/enum-mappers';
import { AuthUser } from '../common/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      this.logger.warn(
        'Login failed: invalid credentials or unavailable account.',
      );
      throw new UnauthorizedException('Invalid email or password.');
    }
    this.logger.log(`Login successful for user ${user.id}.`);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const tokenHash = this.tokenHash(refreshToken);
    const claimed = await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count)
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
    });
    if (!user)
      throw new UnauthorizedException('Account is inactive or unavailable.');
    return this.issueTokens(user);
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash: this.tokenHash(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });
    if (
      !account ||
      !(await compare(dto.currentPassword, account.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: account.id },
        data: {
          passwordHash: await hash(dto.newPassword, 12),
          mustChangePassword: false,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return {
      success: true,
      message: 'Password updated. Please sign in again.',
    };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    role: any;
    organization: any;
    mustChangePassword: boolean;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: roleFromDb[user.role],
      organization: user.organization === 'BIMAN' ? 'Biman' : 'NGGL',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_TTL',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn:
        `${Number(this.config.get('JWT_REFRESH_TTL_DAYS', 30))}d` as JwtSignOptions['expiresIn'],
    });
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + Number(this.config.get('JWT_REFRESH_TTL_DAYS', 30)),
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokenHash(refreshToken),
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        role: payload.role,
        organization: payload.organization,
      },
    };
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
