export function getOrCreateUserId() {
  if (typeof window === "undefined") return "anonymous";

  const existingUserId = localStorage.getItem("artin_user_id");

  if (existingUserId) {
    return existingUserId;
  }

  const newUserId =
    "user_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10);

  localStorage.setItem("artin_user_id", newUserId);

  return newUserId;
}