import "express-session";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  }
}
