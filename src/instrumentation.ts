export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncSchedules } = await import("./lib/scheduler");
    const { startTelegramListener } = await import("./lib/telegramPoller");
    syncSchedules();
    startTelegramListener();
  }
}
