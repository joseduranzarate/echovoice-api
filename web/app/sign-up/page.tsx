import { redirect } from "next/navigation";

// SSO sign-in and sign-up are the same gesture — Clerk's OAuth flow
// create-or-finds the user. One screen handles both.
export default function SignUpPage() {
  redirect("/sign-in");
}
