window.APP_CONFIG = {
  UPSCALE_PROXY_URL: "https://runninghub-upscale-worker.ste611003.workers.dev",
  UPSCALE_WORKFLOWS: [
    {
      id: "seedvr2",
      label: "SeedVR2 高清放大",
      provider: "runninghub",
      default: true,
    },
  ],
  REMOVE_BG_PROXY_URL: "https://runninghub-removebg-worker.ste611003.workers.dev",
  REMOVE_BG_WORKFLOWS: [
    {
      id: "rmbg20",
      label: "RMBG-2.0 高质量抠图",
      provider: "runninghub",
      default: true,
    },
  ],
};
