# Challenge Level 5: Principal Boss Architecture (MVC API Gateway)

## 1. Scenario
Your startup has outgrown its single `server.js` file. The CEO wants you to build a production-ready "API Gateway" for a new microservice. This gateway will be the single entry point for all frontend apps. It must integrate everything you have learned: CORS, Global Error Handling, Zod Validation, Authentication, and clean MVC routing.

## 2. The Requirements
Build the `app.js` file that acts as the core configuration for an enterprise Express app.
- Must configure `express.json()` and Helmet (security headers).
- Must configure CORS to allow `credentials` from `https://frontend.app` only.
- Must configure a Global Rate Limiter (Fixed Window is fine for this).
- Must mount a User Router at `/api/v1/users`.
- The User Router must have a `POST /` endpoint that:
  1. Validates the body with Zod (requires `email` and `password`).
  2. Hashes the password with Bcrypt.
  3. Returns a 201 Created with the user's email.
- Must end with a Global Error Handler that catches Zod Errors and returns 400, or catches standard errors and returns 500 (hiding stack traces in production).

## 3. Architecture Diagram
```text
[ Incoming Request POST /api/v1/users ]
        |
[ Helmet / express.json() / CORS ]
        |
[ Rate Limiter ]
        |
[ User Router ]
        |
[ Zod Validation Middleware ] -> (Fails? Throw to Global Error Handler)
        |
[ User Controller (Bcrypt) ]
        |
[ 201 Response ]
```

## 4. Starter Template
*(Try creating this from scratch based on the requirements above before looking at the solution!)*

## 5. Solution Walkthrough

### The Code
```javascript
// app.js (The Entry Point)
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const bcrypt = require('bcryptjs');

const app = express();

// ==========================================
// 1. GLOBAL MIDDLEWARE PIPELINE
// ==========================================
// Note: In production, always add `app.use(helmet())` here!
app.use(express.json());

app.use(cors({
  origin: 'https://frontend.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
app.use('/api/', globalLimiter);


// ==========================================
// 2. VALIDATION LAYER (Zod)
// ==========================================
const userSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    // Pass Zod errors to the global error handler
    next(err);
  }
};


// ==========================================
// 3. CONTROLLER LAYER
// ==========================================
const userController = {
  createUser: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // (Mock DB Save would happen here)

      res.status(201).json({
        message: 'User created securely',
        user: { email }
      });
    } catch (err) {
      next(err);
    }
  }
};


// ==========================================
// 4. ROUTER LAYER
// ==========================================
const userRouter = express.Router();
userRouter.post('/', validate(userSignupSchema), userController.createUser);

// Mount the router
app.use('/api/v1/users', userRouter);


// ==========================================
// 5. GLOBAL ERROR HANDLER (The Safety Net)
// ==========================================
const errorHandler = (err, req, res, next) => {
  console.error('[System Error]:', err);

  // Handle Zod Validation Errors cleanly
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      status: 'fail',
      errors: err.errors.map(e => ({ field: e.path[0], message: e.message }))
    });
  }

  // Handle all other errors
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
};

app.use(errorHandler);

module.exports = app;
```

### Why this is Principal Level
This is the ultimate culmination of backend architecture. By strictly separating concerns (Middleware -> Validation -> Router -> Controller -> Error Handler), you have created a codebase that a team of 50 developers can work on simultaneously without stepping on each other's toes. It is secure by default, resilient to abuse, and handles failures gracefully. This is how enterprise software is built.

## 6. Test Suite (Jest & Supertest)
```javascript
const request = require('supertest');
const app = require('./app');

describe('Level 5: Principal API Gateway', () => {
  it('should return CORS headers for allowed origin', async () => {
    const res = await request(app)
      .options('/api/v1/users')
      .set('Origin', 'https://frontend.app');

    expect(res.headers['access-control-allow-origin']).toBe('https://frontend.app');
  });

  it('should return 400 Zod error for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'https://frontend.app')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('email');
  });

  it('should successfully create user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Origin', 'https://frontend.app')
      .send({ email: 'test@test.com', password: 'supersecretpassword' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@test.com');
  });
});
```
