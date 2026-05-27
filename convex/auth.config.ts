const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER || "https://clerk-jwt-issuer-placeholder.com",
      applicationID: "uet-gpt",
    },
  ],
};

export default authConfig;
