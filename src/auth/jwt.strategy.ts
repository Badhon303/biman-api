import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { roleFromDb } from '../common/enum-mappers';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  organization: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
    });
    if (!user)
      throw new UnauthorizedException('Account is inactive or unavailable.');
    return {
      sub: user.id,
      email: user.email,
      role: roleFromDb[user.role],
      organization: user.organization === 'BIMAN' ? 'Biman' : 'NGGL',
      mustChangePassword: user.mustChangePassword,
    };
  }
}
