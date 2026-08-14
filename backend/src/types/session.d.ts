import "express-session";

declare module "express-session" {
  interface SessionData {
    auth?: {
      role: "admin";
      id: number; // admin_users.id
    };
  }
}
