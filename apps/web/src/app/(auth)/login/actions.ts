"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email address is required." };
  }
  if (typeof password !== "string" || !password) {
    return { error: "Password is required." };
  }

  const { error } = await auth.signIn.email({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("Sign-in error:", {
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
      name: typeof error === "object" && error !== null && "name" in error ? error.name : undefined,
      message:
        typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "Authentication failed",
    });
    return { error: "Invalid email or password. Please try again." };
  }

  redirect("/");
}
