import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "CUSTOMER";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: "ADMIN" | "CUSTOMER";
  }
}
