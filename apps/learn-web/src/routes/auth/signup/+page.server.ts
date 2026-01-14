import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ request, cookies, platform }) => {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const displayName = formData.get("displayName")?.toString();
    const returnUrl = formData.get("returnUrl")?.toString() || "/paths";

    if (!email || !password) {
      return fail(400, { error: "Email and password are required" });
    }

    const identityUrl =
      platform?.env?.IDENTITY_WORKER_URL || "https://id.createsomething.space";

    try {
      const response = await fetch(`${identityUrl}/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ message: "Signup failed" }))) as { message?: string };
        return fail(response.status, {
          error: errorData.message || "Unable to create account",
        });
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
      };
      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;

      // Set cookies
      cookies.set("learn_access_token", accessToken, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60, // 1 hour
      });

      cookies.set("learn_refresh_token", refreshToken, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    } catch (error) {
      console.error("Signup error:", error);
      return fail(500, {
        error: "Unable to connect to authentication service",
      });
    }

    throw redirect(303, returnUrl);
  },
};
