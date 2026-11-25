export type Entity = {
  id: string;
  space: string;
  owner: string;
  kind: string;
  name: string;
  description: string;
  category: string;
  cover: string;
  created: string;
  visibility: string;
  eventDate?: string;
  place?: string;
  latitude: number | null;
  longitude: number | null;
  invited: string[];
};
export type Media = {
  id: string;
  space: string;
  owner: string;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  created: string;
  deleted: string | null;
  entities: string[];
  favorite: boolean;
  meta: {
    duration?: number;
    videoPreview?: boolean;
    taken?: string;
    latitude?: number;
    longitude?: number;
  };
  demoSrc?: string;
};
export type Settings = {
  theme: "light" | "dark";
  visibility: "private" | "family" | "invited";
  geolocation: boolean;
  desktopNotifications?: boolean;
  animations?: boolean;
  commentNotifications: boolean;
  sharedNotifications: boolean;
  avatar?: string;
  heroImage?: string;
  heroPosition?: number;
};
export type User = {
  id: string;
  name: string;
  email: string;
  settings: Settings;
};
export type State = {
  user: User | null;
  media: Media[];
  entities: Entity[];
  spaces: { id: string; name: string; role: string; ownerName?: string }[];
  members: {
    id: string;
    name: string;
    email: string;
    space: string;
    role: string;
    label?: string;
    blockedAlbums?: string[];
  }[];
  notifications: {
    id: string;
    text: string;
    read: number;
    media: string;
    created: string;
  }[];
  bytes: number;
};
export const src = (m: Media, thumb = true) =>
  m.demoSrc || "/api/files/" + m.id + "/" + (thumb ? "thumb" : "original");
export async function api(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const response = await fetch("/api" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}
export const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(0) + " КБ"
    : bytes < 1024 ** 3
      ? (bytes / 1024 ** 2).toFixed(1) + " МБ"
      : (bytes / 1024 ** 3).toFixed(2) + " ГБ";
export const date = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU");
