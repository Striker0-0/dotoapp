import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { cachedEvents } from "@/lib/calendar";
import { buildReminders } from "@/lib/reminders";
import { addDays, todayYmd } from "@/lib/stats";
import { useStore } from "@/lib/store";

const CHANNEL = "doto-lembretes";

export const notificationsSupported = () => Capacitor.isNativePlatform();

/** Asks Android for permission to show notifications (Android 13+ shows a prompt). */
export async function requestNotifyPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch {
    return false;
  }
}

async function run(): Promise<number> {
  if (!notificationsSupported()) return 0;
  try {
    // Everything is rebuilt from scratch, so start from a clean slate.
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n: { id: number }) => ({ id: n.id })),
      });
    }

    const state = useStore.getState();
    if (!state.notify.enabled) return 0;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return 0;

    const today = todayYmd();
    const reminders = buildReminders({
      now: new Date(),
      globalTasks: state.globalTasks,
      events: cachedEvents(today, addDays(today, 8)),
      autoplan: state.autoplan,
      notify: state.notify,
    });
    if (reminders.length === 0) return 0;

    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: "Lembretes",
      description: "Resumo do dia, provas e metas",
      importance: 4,
    });
    await LocalNotifications.schedule({
      notifications: reminders.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        largeBody: r.detail,
        channelId: CHANNEL,
        schedule: { at: r.at, allowWhileIdle: true },
      })),
    });
    return reminders.length;
  } catch (e) {
    console.error("notifications", e);
    return 0;
  }
}

let chain: Promise<number> = Promise.resolve(0);

/** Rebuilds the phone reminders. Calls queue up so they never overlap. Returns how many were scheduled. */
export function syncNotifications(): Promise<number> {
  chain = chain.then(run, run);
  return chain;
}

/** Shows one notification in a few seconds, to check that they work. */
export async function sendTestNotification(): Promise<boolean> {
  if (!(await requestNotifyPermission())) return false;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: "Lembretes",
      description: "Resumo do dia, provas e metas",
      importance: 4,
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: "Teste de lembrete",
          body: "Se você está vendo isto, as notificações funcionam.",
          channelId: CHANNEL,
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
