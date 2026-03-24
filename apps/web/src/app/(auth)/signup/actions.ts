"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Full name is required." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email address is required." };
  }
  if (typeof password !== "string" || !password) {
    return { error: "Password is required." };
  }

  const { error } = await auth.signUp.email({
    email: email.trim(),
    name: name.trim(),
    password,
  });

  if (error) {
    console.error("Sign-up error:", error);
    return { error: "Unable to create account. Please try again or contact support." };
  }

  redirect("/");
}
