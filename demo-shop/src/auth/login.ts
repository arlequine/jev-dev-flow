// demo-shop · login.
import { users } from "../db";
import { verifyPassword } from "./password";
import { logger } from "../logger";
import { UnauthorizedError } from "../errors";

export async function login(email: string, password: string) {
  const user = await users.findByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    logger.warn("login failed", { email });
    throw new UnauthorizedError();
  }
  return user;
}
