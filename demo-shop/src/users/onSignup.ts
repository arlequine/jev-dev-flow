// demo-shop · hook de alta de usuario.
import { mailer } from "../mailer";
import type { User } from "./types";

export async function onSignup(user: User) {
  await mailer.sendWelcome(user);
}
