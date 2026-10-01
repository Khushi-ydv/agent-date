import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The bundled demo pool is read from disk at runtime; make sure it ships with the serverless functions.
  outputFileTracingIncludes: {
    "/**": ["./data/people/**", "./data/dates/**"],
  },
};

export default nextConfig;
