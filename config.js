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
  RUNNINGHUB_AI_APP_REMOVE_BG_PROXY_URL: "https://runninghub-ai-removebg-worker.ste611003.workers.dev",
  RUNNINGHUB_AI_APP_REMOVE_BG_APP_ID: "1950866462321876993",
  RUNNINGHUB_AI_APP_REMOVE_BG_LABEL: "RunningHub AI 抠图",
  VIDEO_UPSCALE_PROXY_URL: "",
  VIDEO_CHROMA_PROXY_URL: "",
  VIDEO_UPSCALE_WORKFLOWS: [
    {
      id: "runninghub-video-upscale",
      label: "RunningHub 视频高清放大",
      provider: "runninghub",
      default: true,
    },
  ],
  VIDEO_CHROMA_WORKFLOWS: [
    {
      id: "runninghub-video-chroma",
      label: "RunningHub 视频抠绿幕",
      provider: "runninghub",
      default: true,
    },
  ],
  VIDEO_POLL_INTERVAL_MS: 3000,
  VIDEO_MAX_POLL_COUNT: 120,
  REMOVE_BG_MAX_UPLOAD_SIDE: 1280,
  REMOVE_BG_MAX_POLL_COUNT: 80,
  REMOVE_BG_POLL_INTERVAL_MS: 3000,
  REMOVE_BG_WORKFLOWS: [
    {
      id: "rmbg20",
      label: "RMBG-2.0 高质量抠图",
      provider: "runninghub",
      default: true,
    },
  ],
  REMOVE_BG_AI_APPS: [
    {
      id: "runninghub-ai-removebg",
      label: "RunningHub AI 抠图",
      provider: "runninghub-ai-app",
      appId: "1950866462321876993",
      default: false,
    },
  ],
};
