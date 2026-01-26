# ADR-0006: Clerk for Authentication

## Status

Accepted

## Date

2025-01-21

## Context

We need authentication for:
- User login/signup on the web app
- API route protection on the backend
- User identity for PowerSync sync rules
- Potential future mobile app support

Requirements:
- Email/password authentication
- OAuth providers (Google, Apple) for convenience
- Secure session management
- JWT tokens for backend verification
- Good React/Next.js integration

## Decision

Use **Clerk** for authentication.

### Frontend Integration

```typescript
// apps/web/src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

// In components
import { useUser, useAuth } from "@clerk/nextjs";

function Profile() {
  const { user } = useUser();
  const { getToken } = useAuth();

  // Get JWT for API calls
  const token = await getToken();
}
```

### Backend Verification

```typescript
// apps/server/src/middleware/auth.ts
import { verifyToken } from "@clerk/backend";

export async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    c.set("userId", payload.sub);
    c.set("clerkId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}
```

### User Sync via Webhook

```typescript
// apps/server/src/routes/webhooks.ts
app.post("/webhooks/clerk", async (c) => {
  const payload = await c.req.json();

  if (payload.type === "user.created") {
    // Create user in our database
    await db.insert(users).values({
      id: generateId(),
      clerkId: payload.data.id,
      email: payload.data.email_addresses[0].email_address,
      trainingLevel: "beginner",
      primaryGoal: "hypertrophy",
      preferences: { equipmentAvailable: [], daysPerWeek: 3 },
    });
  }

  return c.json({ received: true });
});
```

## Consequences

### Positive

- Production-ready auth with minimal setup
- Handles email/password, OAuth, MFA out of the box
- Excellent React/Next.js integration
- Pre-built UI components (SignIn, SignUp, UserButton)
- Session caching - users stay authenticated offline
- Webhooks for syncing user data to our database
- Good documentation and support

### Negative

- External dependency (requires internet for initial auth)
- Vendor lock-in for auth
- Cost at scale ($0.02 per MAU after 10k)
- Session validation requires Clerk API (though cached)

### Neutral

- Need to sync user data to our database via webhooks
- JWT tokens need to be passed to PowerSync for sync rules

## Offline Authentication Mitigation

Clerk sessions are cached locally. Once a user has authenticated:
1. Session token is stored in browser
2. Token can be validated locally for a period
3. Only initial login requires internet
4. User can log workouts offline while session is valid

For extended offline periods, we accept that re-authentication will be needed when back online.

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Auth.js (NextAuth) | Open source, flexible | More setup, less polished UI | More work for same result |
| Supabase Auth | Good integration with Supabase | We're not using Supabase | Unnecessary coupling |
| Firebase Auth | Mature, well-documented | Firebase ecosystem lock-in | Don't want Firebase dependency |
| Custom auth | Full control | Security risk, maintenance burden | Not our core competency |
| Lucia | Lightweight, modern | More manual work, newer | Clerk's DX is better |

## References

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk + Next.js Quickstart](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk Backend SDK](https://clerk.com/docs/references/backend/overview)
- [Clerk Webhooks](https://clerk.com/docs/integrations/webhooks)
