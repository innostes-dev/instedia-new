# Module 04: Identity & Files

## Topic 1: Bcrypt Password Hashing

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Imagine storing your users' passwords in plain text in your database (`password: "ILoveDogs123"`). If a hacker dumps your database, they immediately have the passwords for thousands of users. Because people reuse passwords, the hacker can now log into those users' bank accounts and email. If you store plain text passwords, you are legally and morally liable for the breach.

#### 2. Plain English Metaphor (The What)
Think of a meat grinder. You put a steak (the password) into the grinder and turn the handle (Bcrypt). Out comes ground beef (the Hash). If a thief steals the ground beef, they cannot reverse the process to get the original steak back. However, when the user logs in, they give you a new steak. You grind it up and compare the two piles of ground beef. If they match, the password was correct!

#### 3. Complete Runnable Code
```javascript
const bcrypt = require('bcryptjs');

async function hashPassword(plainTextPassword) {
  // 1. Generate salt (random noise)
  const salt = await bcrypt.genSalt(10);

  // 2. Hash the password with the salt
  const hashedPassword = await bcrypt.hash(plainTextPassword, salt);
  return hashedPassword;
}

async function verifyPassword(plainTextPassword, databaseHash) {
  // 3. Compare the plain text to the hash
  const isMatch = await bcrypt.compare(plainTextPassword, databaseHash);
  return isMatch;
}

// Example Usage
(async () => {
  const hash = await hashPassword('mySecret123');
  console.log('Saved to DB:', hash);
  // Output: $2a$10$xyz123...

  const success = await verifyPassword('mySecret123', hash);
  console.log('Login Success:', success); // true
})();
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Salt**
A salt is a random string added to the password before hashing. If two users have the password "password123", the salt ensures they have completely different hashes. This defeats "Rainbow Table" attacks.
```javascript
const salt = await bcrypt.genSalt(10); // 10 is the "cost factor"
```

**Step 2: The Hash**
Bcrypt runs the password and the salt through a mathematical algorithm thousands of times. The output is a long string that looks like `$2a$10$C.3a...`. This string actually contains the salt and the algorithm version inside it.
```javascript
const hashedPassword = await bcrypt.hash(plainTextPassword, salt);
```

**Step 3: The Comparison**
You never decrypt the hash (it's impossible). Instead, `bcrypt.compare` extracts the salt from the saved hash, applies it to the login attempt, hashes it, and checks if the outputs are identical.
```javascript
const isMatch = await bcrypt.compare(loginAttempt, savedHash);
```

#### 5. ASCII Data Flow
```text
[ Sign Up ] ---> "hunter2" + [ Random Salt "A1" ] ---> (Bcrypt) ---> Hash "$2a$..XyZ" (Saved to DB)

[ Log In ]  ---> "hunter2" (Attempt)
                        |
                        V
(Bcrypt reads "$2a$..XyZ", extracts salt "A1")
                        |
                        V
            "hunter2" + "A1" ---> (Bcrypt) ---> Hash "$2a$..XyZ"
                        |
                        V
            Does "$2a$..XyZ" === "$2a$..XyZ" ? YES -> Login OK
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using fast hashing algorithms like MD5 or SHA-256 for passwords. Hackers use GPUs that can calculate billions of MD5 hashes per second, cracking them instantly.
**Pro Tip:** Bcrypt is intentionally slow. The "Cost Factor" (e.g., 10 or 12) determines how many rounds of hashing occur. If computers get faster, you simply increase the cost factor to 14 to keep the hash time around 250-500ms, making brute-forcing economically impossible.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Write an Express signup route that takes a password from `req.body`, hashes it using bcrypt, and returns the hash.
<details>
<summary>Hint</summary>
Make the route `async` and `await bcrypt.hash(req.body.password, 10)`.
</details>

**Solution Walkthrough:**
```javascript
app.post('/api/signup', async (req, res) => {
  const { password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10); // 10 generates the salt automatically

  // In reality, save to DB here
  res.json({ hash: hashedPassword });
});
```

#### Level 2: Real-World
**Task:** Write a login route. It must find a fake user from an array, compare the password using bcrypt, and return a 401 Unauthorized if it fails, or a 200 OK if it succeeds.
<details>
<summary>Hint</summary>
Use `await bcrypt.compare(req.body.password, user.passwordHash)`.
</details>

**Solution Walkthrough:**
```javascript
const fakeDB = [{ email: 'x@x.com', hash: '$2a$10$SOME_HASH_HERE' }];

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = fakeDB.find(u => u.email === email);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.hash);

  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' }); // Use exact same error message!

  res.json({ message: 'Login successful' });
});
```

#### Level 3: Boss Level
**Task:** Prevent Timing Attacks. If a user is NOT found in the database, the server returns a 401 instantly. If they ARE found, it takes 300ms to calculate bcrypt. A hacker can measure this time to figure out which emails exist in your system. Fix it.
<details>
<summary>Hint</summary>
If the user isn't found, you must still run a dummy `bcrypt.compare` against a random string to simulate the delay, so both success and failure take exactly the same amount of time.
</details>

**Solution Walkthrough:**
```javascript
const dummyHash = '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF'; // Pre-computed dummy hash

app.post('/api/secure-login', async (req, res) => {
  const { email, password } = req.body;
  const user = fakeDB.find(u => u.email === email);

  if (!user) {
    // RUN DUMMY COMPARE TO WASTE TIME!
    await bcrypt.compare(password, dummyHash);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.hash);

  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ message: 'Login successful' });
});
```
This is Principal-level security engineering. Never leak information through response times.

---

## Topic 2: Stateless JWT & Refresh Tokens

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
Historically, servers used "Sessions" stored in RAM. When Alice logged in, the server wrote `Alice=LoggedIn` in its memory and gave Alice a Cookie ID. But if you have 1 million users, your server runs out of RAM. Worse, if you run three servers behind a load balancer, Server B doesn't have Server A's memory, so Alice randomly gets logged out.

#### 2. Plain English Metaphor (The What)
Think of a physical Passport (JWT). When you enter a country, the border agent doesn't call a central database to verify you exist. They simply look at the cryptographic seal (signature) on the passport itself. Because the passport carries all your information and cannot be forged, the agent can verify you entirely offline (stateless).

#### 3. Complete Runnable Code
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'super-secret-key-do-not-share';

// 1. Generate Token (Login)
function generateToken(user) {
  // Payload: Data inside the passport
  const payload = { userId: user.id, role: user.role };

  // Sign the passport with our secret stamp, valid for 1 hour
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// 2. Verify Token (Middleware)
function verifyToken(token) {
  try {
    // If the token was altered by 1 character, or is expired, this throws an error
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null; // Invalid token
  }
}

const myToken = generateToken({ id: 101, role: 'user' });
console.log('Token:', myToken);

const verifiedData = verifyToken(myToken);
console.log('Verified:', verifiedData); // { userId: 101, role: 'user', iat: ..., exp: ... }
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Payload**
The JWT payload contains the claims (data) you want to assert about the user. NEVER put sensitive info (like passwords) here, as anyone can decode a JWT (it's base64 encoded, not encrypted).
```javascript
const payload = { userId: 101 };
```

**Step 2: The Signature**
`jwt.sign` takes the payload, adds a header, and hashes them together using your `JWT_SECRET`. This creates the signature part of the token. If a hacker alters the payload (e.g., changes `userId` to `1`), the signature will no longer match, and the token becomes invalid.
```javascript
const token = jwt.sign(payload, JWT_SECRET);
```

**Step 3: The Verification**
`jwt.verify` takes the token and your secret. It recalculates the signature. If it matches the signature on the token, it returns the payload. The server didn't have to check a database!
```javascript
const decoded = jwt.verify(token, JWT_SECRET);
```

#### 5. ASCII Data Flow
```text
[ Client ]                            [ Server ]
    | --- POST /login (Credentials) ----> | (Verifies Bcrypt)
    |                                     | (Generates JWT)
    | <------- Returns JWT Token -------- |
    |                                     |
    | --- GET /data + [Header: JWT] ----> |
    |                                     | (jwt.verify(token) using Secret)
    | <------- Returns Protected Data --- |
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using a single long-lived JWT (e.g., expires in 1 year). Because JWTs are stateless, you cannot easily revoke them! If a hacker steals the token, they have access for a year.
**Pro Tip:** Use Short-Lived Access Tokens (expires in 15 mins) and Long-Lived Refresh Tokens. The client uses the Access Token for API calls. When it expires, the client sends the Refresh Token to an `/auth/refresh` endpoint to get a new Access Token. Refresh tokens ARE stored in the database so they can be explicitly revoked by the server if stolen.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Create an Express middleware that checks the `Authorization` header for a Bearer token, verifies it, and attaches the payload to `req.user`.
<details>
<summary>Hint</summary>
Split the header string on space (`authHeader.split(' ')[1]`) to get the token part. Use `jwt.verify`.
</details>

**Solution Walkthrough:**
```javascript
const requireJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

#### Level 2: Real-World
**Task:** Implement a `/refresh` endpoint. It receives a refresh token, verifies it, and if valid, issues a brand new short-lived Access Token.
<details>
<summary>Hint</summary>
You need two different secrets: `ACCESS_SECRET` and `REFRESH_SECRET`.
</details>

**Solution Walkthrough:**
```javascript
app.post('/api/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.sendStatus(401);

  try {
    // 1. Verify Refresh Token
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);

    // 2. In reality, check if token is blacklisted in DB here...

    // 3. Issue new Access Token (15 mins)
    const newAccessToken = jwt.sign(
      { userId: payload.userId },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});
```

#### Level 3: Boss Level
**Task:** The ultimate security setup: Store the Access Token in memory on the frontend, but store the Refresh Token in an HttpOnly, Secure Cookie. This prevents Cross-Site Scripting (XSS) attacks from stealing the Refresh Token. Write the login endpoint that sets this cookie.
<details>
<summary>Hint</summary>
Use `res.cookie('refreshToken', token, { httpOnly: true, secure: true, sameSite: 'strict' })`.
</details>

**Solution Walkthrough:**
```javascript
app.post('/api/login', (req, res) => {
  // ... verify credentials ...
  const userId = 42;

  const accessToken = jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });

  // The critical security step!
  // HttpOnly: JS in the browser cannot read it (beats XSS)
  // Secure: Only sent over HTTPS
  res.cookie('jwt_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Only send the access token in the JSON body
  res.json({ accessToken });
});
```
This is the industry-standard "gold tier" approach to JWT authentication.

---

## Topic 3: Multer File Uploads

### Phase A: The Core Concept

#### 1. Real-World Pain Point (The Why)
When a user uploads a profile picture, it is not sent as JSON. It is sent as a `multipart/form-data` stream of binary bytes. Express's standard `express.json()` middleware cannot read this. If you try, `req.body` will be empty, and you will not have access to the file. You need a specialized tool to parse multipart streams and save the files to disk.

#### 2. Plain English Metaphor (The What)
Think of a recycling plant sorting line. Normal garbage (JSON) goes straight through. But sometimes a massive crate (A File) arrives. `Multer` is the specialized forklift operator. When a crate arrives, Multer intercepts it, takes it off the line, opens it, saves the contents into the warehouse (Hard Drive/S3), and hands the foreman (Controller) a clipboard with the storage location (`req.file`).

#### 3. Complete Runnable Code
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// 1. Configure the Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to the 'uploads' folder
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Rename file to avoid collisions (e.g., timestamp-avatar.png)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 2. Initialize Multer
const upload = multer({ storage: storage });

// 3. Apply as Middleware to Route ('avatar' is the form field name)
app.post('/api/upload', upload.single('avatar'), (req, res) => {
  // req.file contains info about the saved file
  // req.body contains the rest of the text fields

  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  res.json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path
  });
});

app.listen(3000, () => console.log('Server running'));
```

#### 4. Progressive Step-by-Step Breakdown

**Step 1: The Storage Configuration**
We tell Multer *where* to put the files and *what* to name them. By using `Date.now()`, we ensure that if two users upload `image.png` at the same time, they don't overwrite each other.
```javascript
const storage = multer.diskStorage({ destination: ..., filename: ... });
```

**Step 2: The Middleware Instance**
We pass our storage config into Multer.
```javascript
const upload = multer({ storage });
```

**Step 3: The Route Guard**
We use `upload.single('avatar')`. This looks for a form field named `avatar` containing exactly one file. Multer processes the file stream, saves it to disk, and attaches the metadata to `req.file`.
```javascript
app.post('/upload', upload.single('avatar'), controller);
```

#### 5. ASCII Data Flow
```text
[ Client (Form Data) ]
    |--- Text: username="Alice"
    |--- File: avatar (binary stream)
    V
[ Multer Middleware ]
    |---> Saves stream to ./uploads/12345-avatar.png
    V
[ Route Controller ]
    |---> req.body.username = "Alice"
    |---> req.file.path = "uploads/12345-avatar.png"
```

#### 6. Noob Trap vs Pro Tip
**Noob Trap:** Using `multer({ dest: 'uploads/' })` without checking file types. A hacker could upload `script.php` or `virus.exe`, execute it on your server, and gain full control of your infrastructure.
**Pro Tip:** ALWAYS implement a `fileFilter` in Multer to strictly allow only specific MIME types (like `image/jpeg` or `image/png`). Never trust the file extension; verify the MIME type. Also, enforce a strict `limits: { fileSize: 5 * 1024 * 1024 }` (5MB) to prevent users from crashing your server by uploading 50GB ISO files.

---

### Phase B: Challenges

#### Level 1: Warm-Up
**Task:** Update a Multer instance to accept an array of up to 5 images from a form field called `gallery`.
<details>
<summary>Hint</summary>
Use `upload.array('gallery', 5)` instead of `upload.single()`. The controller will access `req.files` (plural).
</details>

**Solution Walkthrough:**
```javascript
app.post('/api/gallery', upload.array('gallery', 5), (req, res) => {
  // req.files is an array of file objects
  const fileNames = req.files.map(file => file.filename);
  res.json({ uploaded: fileNames });
});
```

#### Level 2: Real-World
**Task:** Implement a `fileFilter` that rejects any file that is not a JPEG or PNG image. If rejected, it should return a clean error, not crash the server.
<details>
<summary>Hint</summary>
Pass `fileFilter: (req, file, cb) => { ... }` into the `multer()` config object. Check `file.mimetype`.
</details>

**Solution Walkthrough:**
```javascript
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    // Accept the file
    cb(null, true);
  } else {
    // Reject the file with a custom error
    cb(new Error('Only JPEG and PNG files are allowed!'), false);
  }
};

const safeUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB Limit
});

// Note: You must handle the error thrown by cb(new Error()) in a middleware wrapper or global error handler.
```

#### Level 3: Boss Level
**Task:** Instead of saving the file to the local server disk (which breaks if you scale to multiple servers), process the file in Memory (RAM) and immediately upload it to AWS S3.
<details>
<summary>Hint</summary>
Use `multer.memoryStorage()`. This keeps the file in RAM as a Buffer (`req.file.buffer`). You then pass this buffer to the AWS S3 client in your controller.
</details>

**Solution Walkthrough:**
```javascript
// Use Memory Storage! No files are written to disk.
const storage = multer.memoryStorage();
const memoryUpload = multer({ storage });

app.post('/api/avatar', memoryUpload.single('avatar'), async (req, res) => {
  try {
    // The raw file bytes are available in req.file.buffer
    const fileBuffer = req.file.buffer;

    // Pseudo-code for S3 upload
    // const s3Result = await s3.upload({
    //   Bucket: 'my-bucket',
    //   Key: req.file.originalname,
    //   Body: fileBuffer
    // }).promise();

    res.json({ message: 'Uploaded directly to cloud!' });
  } catch (err) {
    res.status(500).send('Upload failed');
  }
});
```
This is how modern cloud architectures handle file uploads. Storing files locally on an API server is considered an anti-pattern in scalable cloud deployments.
