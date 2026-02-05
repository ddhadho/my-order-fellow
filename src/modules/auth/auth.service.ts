import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.company.findUnique({
      where: { businessEmail: dto.businessEmail },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create company
    const company = await this.prisma.company.create({
      data: {
        companyName: dto.companyName,
        businessEmail: dto.businessEmail,
        password: hashedPassword,
        emailOtp: otp,
        emailOtpExpiresAt: otpExpiry,
      },
    });

    // Send OTP email
    const emailHtml = this.emailService.generateOtpEmail(otp);
    await this.emailService.sendEmail(
      dto.businessEmail,
      'Verify Your Email',
      emailHtml,
    );

    return {
      message: 'Registration successful. Please verify your email.',
      companyId: company.id,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const company = await this.prisma.company.findUnique({
      where: { businessEmail: dto.businessEmail },
    });

    if (!company) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (company.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (company.emailOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (!company.emailOtpExpiresAt || new Date() > company.emailOtpExpiresAt) {
      throw new UnauthorizedException('OTP expired');
    }

    // Mark as verified
    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        isEmailVerified: true,
        emailOtp: null,
        emailOtpExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const company = await this.prisma.company.findUnique({
      where: { businessEmail: dto.businessEmail },
    });

    if (!company) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, company.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!company.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const payload = { sub: company.id, email: company.businessEmail };
    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      company: {
        id: company.id,
        companyName: company.companyName,
        email: company.businessEmail,
        kycStatus: company.kycStatus,
      },
    };
  }
}
