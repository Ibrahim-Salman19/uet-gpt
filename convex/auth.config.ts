const issuer = process.env.CLERK_JWT_ISSUER;
if (!issuer) {
  throw new Error("CLERK_JWT_ISSUER environment variable is missing.");
}

const authConfig = {
  providers: [
    {
      domain: issuer,
      applicationID: "uet-gpt",
    },
  ],
};

export default authConfig;
