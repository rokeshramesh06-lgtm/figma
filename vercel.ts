export const config = {
  rewrites: [
    {
      source: "/api",
      destination: "/api/server",
    },
    {
      source: "/api/:path*",
      destination: "/api/server?path=:path*",
    },
  ],
};
