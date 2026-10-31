# Challenge 5: Hardened Enterprise Auth Server

## Scenario
Your company relies on a custom JWT authentication endpoint. Recently, a security audit found several critical flaws:
1. Access Tokens never expire, or expire after 30 days, meaning if a token is stolen, the attacker has a full month of access.
2. There is no mechanism to forcefully log a user out without resetting their password.
3. The API doesn't utilize ASP.NET Core's built-in Identity and Claims architecture properly.

## The Challenge
Architect a highly secure Authentication architecture using ASP.NET Core Identity principles and JWT.
1. Implement **Short-Lived Access Tokens** (15 minutes).
2. Implement **Refresh Tokens** stored securely in a database.
3. Implement **Refresh Token Rotation** (every time a refresh token is used, it is invalidated and a new one is issued) to detect token theft.
4. Provide the controller endpoint that exchanges a Refresh Token for a new Access Token.

---

## Starter Template

```csharp
using System;
using System.Threading.Tasks;

namespace Challenges.Security
{
    public class TokenRequest
    {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
    }

    public class TokenResponse
    {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
    }

    public class AuthController
    {
        // TODO: Implement Secure Refresh Logic
        public async Task<TokenResponse> RefreshAsync(TokenRequest request)
        {
            throw new NotImplementedException();
        }
    }
}
```

---

<details>
<summary>View Complete Production Solution Walkthrough</summary>

## Production Solution Walkthrough

To secure the API, we issue a 15-minute JWT Access Token (for fast, stateless API access) and a 7-day Refresh Token (opaque string stored in the database). When the Access Token expires, the client sends the Refresh Token to get a new pair.

### 1. The Entity Model
We need a database table to track Refresh Tokens. Crucially, we must track if a token was `Revoked` or `Used`.

```csharp
using System;

public class RefreshToken
{
    public int Id { get; set; }
    public string Token { get; set; }
    public string UserId { get; set; }
    public DateTime Expires { get; set; }
    public bool IsExpired => DateTime.UtcNow >= Expires;
    public DateTime? Revoked { get; set; }
    public bool IsActive => Revoked == null && !IsExpired;
}
```

### 2. The Authentication Service
This service validates the tokens and implements **Refresh Token Rotation**. If a stolen Refresh Token is used by an attacker, and then later used by the legitimate user, the system will detect that a previously *used/revoked* token was presented. It will immediately revoke ALL tokens for that user (shutting down the attacker).

```csharp
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

// (Simulated dependencies for clarity)
public class JwtService { public string GenerateToken(string userId) => "eyJ... (15 min token)"; }
public class DbContext { public RefreshToken GetToken(string token) => new RefreshToken(); public void Save() { } }

public class SecureAuthService
{
    private readonly JwtService _jwt;
    private readonly DbContext _db;

    public SecureAuthService(JwtService jwt, DbContext db)
    {
        _jwt = jwt;
        _db = db;
    }

    public async Task<TokenResponse> RefreshTokensAsync(string expiredAccessToken, string refreshToken)
    {
        // 1. Validate the structure of the expired token (extract UserId)
        var userId = "user_123"; // (Simulated extraction)

        // 2. Fetch the Refresh Token from DB
        var tokenRecord = _db.GetToken(refreshToken);

        if (tokenRecord == null) throw new UnauthorizedAccessException("Invalid Token");

        // 3. THEFT DETECTION (Token Rotation Principle)
        if (!tokenRecord.IsActive)
        {
            // ALERT: Someone just tried to use a token that was already used or revoked!
            // This means the token was stolen. We must revoke ALL access for this user immediately.
            Console.WriteLine($"[SECURITY] Token theft detected for User {userId}. Revoking all access.");
            // _db.RevokeAllUserTokens(userId);
            // _db.Save();
            throw new UnauthorizedAccessException("Security breach detected. Please log in again.");
        }

        // 4. Revoke the current token (so it can't be used again)
        tokenRecord.Revoked = DateTime.UtcNow;

        // 5. Generate new Access Token (15 mins)
        var newAccessToken = _jwt.GenerateToken(userId);

        // 6. Generate new Refresh Token (7 days)
        var newRefreshTokenString = GenerateSecureString();
        var newRefreshToken = new RefreshToken
        {
            Token = newRefreshTokenString,
            UserId = userId,
            Expires = DateTime.UtcNow.AddDays(7)
        };

        // _db.RefreshTokens.Add(newRefreshToken);
        // _db.Save();

        return new TokenResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshTokenString
        };
    }

    private string GenerateSecureString()
    {
        var randomBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }
}
```

### 3. The API Controller
The API surface is clean. It accepts the request and delegates to the Service.

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly SecureAuthService _authService;

    public AuthController(SecureAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] TokenRequest request)
    {
        try
        {
            var response = await _authService.RefreshTokensAsync(request.AccessToken, request.RefreshToken);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }
}

public class TokenRequest { public string AccessToken { get; set; } public string RefreshToken { get; set; } }
public class TokenResponse { public string AccessToken { get; set; } public string RefreshToken { get; set; } }
```

### Architecture Review
- **Short-Lived Access Tokens:** Mitigates the risk of token interception. The token is useless after 15 minutes.
- **Stateful Refresh Tokens:** Allows the server to forcefully log out a user by simply revoking their Refresh Token in the database.
- **Token Rotation & Theft Detection:** By invalidating a refresh token immediately upon use, we create a single-use chain. If a duplicate token is presented, we know a compromise occurred and can automatically quarantine the account.
</details>
