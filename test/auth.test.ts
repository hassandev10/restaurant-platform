import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/services/auth-service";

test("Admin Authentication Service Unit Tests (Real Go Backend)", async (t) => {
  const auth = new AuthService();

  await t.test("Login with valid admin credentials succeeds and returns JWT", async () => {
    const user = await auth.login("admin", "password123");
    assert.ok(user, "User should be returned");
    assert.equal(user.username, "admin");
    assert.equal(user.role, "ADMIN");
    assert.ok(user.token, "JWT token must be present");
    assert.ok(user.name.length > 0, "Staff name must not be empty");
  });

  await t.test("Login with invalid password throws Arabic error message", async () => {
    await assert.rejects(
      async () => {
        await auth.login("admin", "wrongpassword");
      },
      (err: any) => {
        assert.ok(
          err.message.includes("غير صحيحة") || err.message.includes("رمز 401"),
          `Expected authentication error message, got: ${err.message}`
        );
        return true;
      }
    );
  });

  await t.test("Login with empty fields throws validation error", async () => {
    await assert.rejects(
      async () => {
        await auth.login("", "");
      },
      {
        message: "يرجى إدخال اسم المستخدم وكلمة المرور",
      }
    );
  });

  await t.test("Logout clears session", async () => {
    await auth.login("admin", "password123");
    auth.logout();
    assert.equal(auth.getCurrentUser(), null);
    assert.equal(auth.isAuthenticated(), false);
  });
});
