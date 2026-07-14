import { getServerScoped, setServerScoped } from "./storageKeys";

/** 跟进行为：排队或引导当前运行 */
export type FollowUpBehavior = "queue" | "steer";

/** 默认跟进行为 */
export const DEFAULT_FOLLOW_UP_BEHAVIOR: FollowUpBehavior = "queue";

const FOLLOW_UP_BEHAVIORS: FollowUpBehavior[] = ["queue", "steer"];

/**
 * 反转单条消息的跟进行为，不修改持久化模式。
 */
export function invertFollowUpBehavior(
  mode: FollowUpBehavior,
): FollowUpBehavior {
  return mode === "queue" ? "steer" : "queue";
}

/**
 * 解析本次发送应使用的跟进行为。
 * invertOnce 为 true 时仅对本条消息取反。
 */
export function resolveSendBehavior(
  mode: FollowUpBehavior,
  options?: { invertOnce?: boolean },
): FollowUpBehavior {
  return options?.invertOnce ? invertFollowUpBehavior(mode) : mode;
}

/**
 * 从服务器作用域存储读取跟进行为。
 * 非法值回退到默认 queue。
 */
export function loadFollowUpBehavior(): FollowUpBehavior {
  const stored = getServerScoped("followUpBehavior");
  if (stored && FOLLOW_UP_BEHAVIORS.includes(stored as FollowUpBehavior)) {
    return stored as FollowUpBehavior;
  }
  return DEFAULT_FOLLOW_UP_BEHAVIOR;
}

/**
 * 将跟进行为写入服务器作用域存储。
 */
export function saveFollowUpBehavior(mode: FollowUpBehavior): void {
  setServerScoped("followUpBehavior", mode);
}
