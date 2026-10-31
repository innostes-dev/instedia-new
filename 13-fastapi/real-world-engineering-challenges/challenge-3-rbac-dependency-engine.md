# Challenge 3: RBAC Dependency Engine

## The Challenge
You are securing an internal administrative dashboard for your AI models. You need to implement a clean, reusable Role-Based Access Control (RBAC) system using FastAPI's dependency injection system, ensuring that endpoint business logic remains completely free of security boilerplate.

**Requirements:**
1. Create a `User` Pydantic model (`username: str`, `role: str`).
2. Create a base dependency `get_current_user` that extracts the `Authorization: Bearer <token>` header.
   - If token is `"admin-token"`, return a User with role "admin".
   - If token is `"user-token"`, return a User with role "user".
   - Otherwise, raise an HTTP 401.
3. Create a dependency factory `RoleChecker` (a class with a `__call__` method) that takes a required role.
4. When `RoleChecker` executes, it depends on `get_current_user`. If the current user's role does not match, raise an HTTP 403.
5. Protect a `DELETE /models/{id}` endpoint using this dependency, requiring the "admin" role.

<details>
<summary><b>Solution Walkthrough</b></summary>

```python
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app = FastAPI(title="RBAC Secure API")
security = HTTPBearer()

# 1. The Domain Model
class User(BaseModel):
    username: str
    role: str

# 2. Base Authentication Dependency
def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> User:
    token = credentials.credentials
    if token == "admin-token":
        return User(username="alice", role="admin")
    elif token == "user-token":
        return User(username="bob", role="user")

    raise HTTPException(status_code=401, detail="Invalid token")

# 3. Dependency Factory (Class-based dependency)
class RoleChecker:
    def __init__(self, required_role: str):
        self.required_role = required_role

    # 4. The actual dependency execution
    def __call__(self, user: User = Depends(get_current_user)):
        if user.role != self.required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Operation requires {self.required_role} role"
            )
        return user

# Instantiate the specific checkers we need
require_admin = RoleChecker("admin")
require_user = RoleChecker("user")

# 5. The Protected Endpoint
@app.delete("/models/{model_id}")
async def delete_model(
    model_id: str,
    # FastAPI resolves require_admin, which resolves get_current_user!
    admin_user: User = Depends(require_admin)
):
    return {
        "status": "deleted",
        "model": model_id,
        "deleted_by": admin_user.username
    }
```

**Why this matters:**
This pattern uses a Python class as a "Dependency Factory". Because FastAPI calls whatever is passed to `Depends()` as long as it is callable, using `__call__` on a class instance allows us to pass configuration (`"admin"`) into the dependency at startup time. This creates an incredibly powerful, reusable, and testable security layer. The `/models/{model_id}` endpoint contains absolutely zero `if user.role != 'admin'` checks, adhering perfectly to the Single Responsibility Principle.
</details>
