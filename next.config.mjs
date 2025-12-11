/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i0.wp.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.hubspot.net',
      },
      {
        protocol: 'https',
        hostname: 'images.seeklogo.com',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
      {
        protocol: 'https',
        hostname: 'www.select-sport.com',
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'www.threedots.com',
      },
      {
        protocol: 'https',
        hostname: 'www.instalend.com',
      },
    ],
  },
};

export default nextConfig;
