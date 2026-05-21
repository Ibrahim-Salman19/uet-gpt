const clerkJwtIssuer = process.env.CLERK_JWT_ISSUER;
if (!clerkJwtIssuer) {
  throw new Error("CLERK_JWT_ISSUER environment variable is required");
}

export default {
  providers: [
    {
      domain: clerkJwtIssuer,
      applicationID: "uet-gpt",
    },
  ],
};
