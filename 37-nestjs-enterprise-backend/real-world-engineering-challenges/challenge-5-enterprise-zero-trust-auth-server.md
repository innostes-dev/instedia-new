# Real-World Engineering Challenge: Bank-Grade OAuth2 Zero-Trust Server

## 1. Context & Architecture
In a standard app, a JWT is issued upon login. The JWT is stateless, meaning it cannot be revoked. If a hacker steals a user's JWT, they have access until the token expires.

In a **Zero-Trust Enterprise Environment** (like banking), you must be able to instantly revoke sessions. To achieve this while maintaining the performance benefits of JWTs, you implement a **Hybrid Token System**:
1. **Short-Lived Access Token:** A standard JWT, but it expires very quickly (e.g., 5 minutes). Used for fast authorization via a Guard.
2. **Long-Lived Refresh Token:** Stored securely in an HttpOnly cookie, but *also saved in a database* (e.g., Redis).

When the user logs out (or an admin clicks "Revoke Session"), you delete the Refresh Token from Redis. When the user's 5-minute Access Token expires, their app tries to get a new one using the Refresh Token. Because the Refresh Token is gone from Redis, the request fails, effectively locking the hacker out.

### Architecture Diagram
```text
[Login Request]
       │
       ▼
┌───────────────────────┐  1. Verifies credentials.
│ AuthService           │  2. Generates JWT (Access) and Opaque String (Refresh).
│                       │  3. Saves Refresh Token hash to Database (Session Store).
└──────────┬────────────┘  4. Returns both tokens to client.
           │
           ▼
[Revocation / Logout Request]
       │
       ▼
┌───────────────────────┐
│ SessionController     │ -> Deletes the Refresh Token hash from Database.
└───────────────────────┘ -> (The short-lived JWT is now isolated and will die shortly).
```

---

## 2. Starter Template

```typescript
// npm i @nestjs/common @nestjs/core @nestjs/jwt

import { Injectable, Controller, Post, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// --- MOCK DATABASE ---
// In production, use Redis to store refresh tokens per user
const activeSessions = new Map<number, string>();

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(userId: number) {
    // 1. Generate Access Token (JWT, 5 min expiry)
    // TODO: Generate JWT containing { sub: userId }

    // 2. Generate Refresh Token (Opaque String)
    // TODO: Generate a random string (e.g., UUID or crypto.randomBytes)

    // 3. Store Refresh Token in DB against the user ID
    // TODO: Save to `activeSessions` map

    return {
      accessToken: '...',
      refreshToken: '...'
    };
  }

  async refresh(userId: number, providedRefreshToken: string) {
    // 1. Check if token exists in DB
    // TODO: If not in `activeSessions`, or doesn't match provided token, throw UnauthorizedException

    // 2. Generate new tokens
    // TODO: Call this.login(userId) and return new tokens
  }

  async revokeAllSessions(userId: number) {
    // TODO: Delete user from `activeSessions` map
  }
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: { id: number }) {
    return this.authService.login(body.id);
  }

  @Post('refresh')
  refresh(@Body() body: { id: number, refreshToken: string }) {
    return this.authService.refresh(body.id, body.refreshToken);
  }

  @Post('revoke')
  revoke(@Body() body: { id: number }) {
    return this.authService.revokeAllSessions(body.id);
  }
}
```

---

## 3. Boss Level Challenge
Implement the Hybrid Token System.
1. The `AuthService.login` must generate a JWT signed by `@nestjs/jwt` (Access Token) and a secure random string (Refresh Token). It must store the Refresh Token in the mock `activeSessions` map.
2. The `AuthService.refresh` method must validate that the provided refresh token matches what is stored in `activeSessions`. If it matches, it issues a *new* pair of tokens (rotating the refresh token).
3. Implement `revokeAllSessions` to simulate an admin kicking a compromised user out of the system.

<details>
<summary>Click here for Hints</summary>

- Use `crypto.randomBytes(32).toString('hex')` to generate a secure refresh token.
- Import `JwtModule.register({ secret: 'super-secret', signOptions: { expiresIn: '5m' } })` in your Module.
</details>

<details>
<summary>Click here for Full Production Solution Walkthrough</summary>

### Full Solution Code

```typescript
import {
  Injectable, Controller, Post, Body, UnauthorizedException,
  Module, UseGuards, CanActivate, ExecutionContext
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

// ==========================================
// 1. Storage & Cryptography Setup
// ==========================================
// In production, this MUST be Redis.
const activeRefreshTokens = new Map<number, string>();

@Injectable()
export class ZeroTrustAuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Logs a user in, issuing a short-lived JWT and a long-lived tracked refresh token.
   */
  async login(userId: number) {
    // 1. Generate fast, stateless Access Token (Valid for 5 minutes)
    const accessToken = this.jwtService.sign({ sub: userId });

    // 2. Generate secure, opaque Refresh Token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // 3. Store hashed Refresh Token in Database (Hash it to prevent theft from DB)
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    activeRefreshTokens.set(userId, hashedToken);

    return { accessToken, refreshToken };
  }

  /**
   * Validates the refresh token against the database before issuing new credentials.
   */
  async refreshSession(userId: number, providedRefreshToken: string) {
    const storedHash = activeRefreshTokens.get(userId);

    if (!storedHash) {
      throw new UnauthorizedException('Session expired or revoked.');
    }

    const providedHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');

    if (storedHash !== providedHash) {
      // Possible token theft detected! Revoke all sessions immediately.
      this.revokeAllSessions(userId);
      throw new UnauthorizedException('Invalid refresh token. All sessions revoked.');
    }

    // Token Rotation: Issue a brand new pair. The old refresh token is now invalid.
    return this.login(userId);
  }

  /**
   * Instantly kills a user's ability to get new access tokens.
   */
  revokeAllSessions(userId: number) {
    activeRefreshTokens.delete(userId);
    console.log(`[Security] All sessions revoked for user ${userId}`);
    return { status: 'Revoked' };
  }
}

// ==========================================
// 2. Controllers
// ==========================================
@Controller('bank-auth')
export class AuthController {
  constructor(private readonly authService: ZeroTrustAuthService) {}

  @Post('login')
  login(@Body() body: { userId: number }) {
    // Assume credentials (password/MFA) were verified in a Guard before this
    return this.authService.login(body.userId);
  }

  @Post('refresh')
  refresh(@Body() body: { userId: number, refreshToken: string }) {
    return this.authService.refreshSession(body.userId, body.refreshToken);
  }

  @Post('admin/revoke')
  revokeSession(@Body() body: { targetUserId: number }) {
    // Assume Admin RolesGuard protects this route
    return this.authService.revokeAllSessions(body.targetUserId);
  }
}

// ==========================================
// 3. Module Wiring
// ==========================================
@Module({
  imports: [
    JwtModule.register({
      secret: 'CRITICAL_SYSTEM_SECRET_KEY',
      signOptions: { expiresIn: '5m' }, // 5 minutes!
    })
  ],
  providers: [ZeroTrustAuthService],
  controllers: [AuthController]
})
export class AuthModule {}
```

### Walkthrough & Architecture Notes
1. **Refresh Token Rotation:** Notice how the `refreshSession` method calls `login` again. This means every time a user refreshes their 5-minute JWT, they also get a *new* Refresh Token. The old one is replaced in the Map/Redis. If a hacker steals a refresh token and tries to use it *after* the legitimate user has already rotated it, the hashes won't match, and the system instantly revokes everything.
2. **Database Hashing:** The "Noob Trap" is storing the raw Refresh Token string in the database. If your Redis instance is compromised, the attacker has everyone's refresh tokens. We store a `sha256` hash. The server hashes the incoming token to compare it.
3. **Stateless vs Stateful:** We get the best of both worlds. The `JwtAuthGuard` (not shown here) only checks the JWT, requiring 0 database calls, meaning our API can handle massive traffic extremely fast. We only hit the database once every 5 minutes (during the refresh cycle), which is when we check for revocation.
</details>
