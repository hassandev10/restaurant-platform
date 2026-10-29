import test from "node:test";
import assert from "node:assert/strict";
import { ApiAuthRepository } from "../src/repositories/auth-repository";

test("Staff Authentication Repository Unit Tests (Real Go Backend)", async (t) => {
  const authRepo = new ApiAuthRepository();

  await t.test("Returns all available staff profiles", () => {
    const profiles = authRepo.getAvailableStaffProfiles();
    assert.ok(profiles.length >= 2, "Should have active staff profiles");
    const admin = profiles.find((p) => p.username === "admin");
    assert.ok(admin, "Admin profile should exist");
    assert.equal(admin?.role, "SUPERVISOR");
  });

  await t.test("Login with valid PIN succeeds and returns staff session with JWT", async () => {
    const user = await authRepo.loginWithPin("1234");
    assert.ok(user.name.includes("أحمد"), "Captain Ahmed should match");
    assert.equal(user.role, "SUPERVISOR");
    assert.ok(user.token, "JWT token must be present");
    assert.ok(user.shiftStartedAt, "Shift start timestamp should be set");
    assert.equal(authRepo.getCurrentUser()?.id, user.id);
  });

  await t.test("Login with invalid PIN throws Arabic error message", async () => {
    await assert.rejects(
      async () => {
        await authRepo.loginWithPin("999999");
      },
      {
        message: "رمز الدخول (PIN) غير صحيح. يرجى التأكد والمحاولة مرة أخرى.",
      }
    );
  });

  await t.test("Login with username and credentials succeeds against real backend", async () => {
    const user = await authRepo.loginWithCredentials("admin", "password123");
    assert.equal(user.username, "admin");
    assert.ok(user.token, "Should have valid JWT token");
    assert.equal(authRepo.getCurrentUser()?.id, user.id);
  });

  await t.test("Login with invalid username throws Arabic error", async () => {
    await assert.rejects(
      async () => {
        await authRepo.loginWithCredentials("unknown.user", "0000");
      },
      {
        message: "اسم المستخدم أو كلمة المرور غير صحيحة",
      }
    );
  });

  await t.test("Logout clears current user session", async () => {
    await authRepo.loginWithCredentials("admin", "password123");
    assert.ok(authRepo.getCurrentUser() !== null);
    await authRepo.logout();
    assert.equal(authRepo.getCurrentUser(), null);
  });
});
