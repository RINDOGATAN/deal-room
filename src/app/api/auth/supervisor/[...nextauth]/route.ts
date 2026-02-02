import NextAuth from "next-auth";
import { supervisorAuthOptions } from "@/lib/auth-supervisor";

const handler = NextAuth(supervisorAuthOptions);

export { handler as GET, handler as POST };
