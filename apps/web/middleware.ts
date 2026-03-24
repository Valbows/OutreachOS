import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/login",
});

export const config = {
  matcher: [
    "/",
    "/contacts/:path*",
    "/campaigns/:path*",
    "/templates/:path*",
    "/forms/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/developer/:path*",
  ],
};
