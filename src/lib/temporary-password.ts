import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export function createTemporaryPassword() {
  return randomBytes(9).toString("base64url");
}

export function temporaryPasswordExpiry() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  return expiresAt;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
