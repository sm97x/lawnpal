import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@lawnpal/core"],
  outputFileTracingRoot: path.join(__dirname, "../..")
};

export default nextConfig;
