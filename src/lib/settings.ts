import { prisma } from "@/lib/prisma";

export const SIGNUP_ENABLED_KEY = "signupEnabled";

export async function hasUsers() {
  const count = await prisma.user.count();
  return count > 0;
}

export async function isSignupEnabled() {
  const usersExist = await hasUsers();

  if (!usersExist) {
    return true;
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key: SIGNUP_ENABLED_KEY },
  });

  return setting?.value === "true";
}

export async function setSignupEnabled(enabled: boolean) {
  return prisma.appSetting.upsert({
    where: { key: SIGNUP_ENABLED_KEY },
    update: { value: String(enabled) },
    create: { key: SIGNUP_ENABLED_KEY, value: String(enabled) },
  });
}
