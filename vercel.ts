const backendOrigin = String(process.env.BACKEND_ORIGIN || "").trim().replace(/\/$/, "");

const rewrites = backendOrigin
  ? [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${backendOrigin}/socket.io/:path*`,
      },
    ]
  : [];

export const config = {
  rewrites,
};
