import type { State, Entity, Media } from "./types";
const names = [
  "Отпуск",
  "Лето",
  "Путешествия",
  "Тихое утро",
  "Выходные",
  "Наши места",
];
const entities: Entity[] = names.map((name, i) => ({
  id: "a" + i,
  space: "demo",
  owner: "demo",
  kind: "albums",
  name,
  description: "Демонстрационный альбом",
  category: "Своё",
  cover: "/assets/" + (i + 1) + ".jpg",
  created: "2026-01-01",
  visibility: "family",
  latitude: null,
  longitude: null,
  invited: [],
}));
for (const [kind, items] of Object.entries({
  tags: ["Семья", "Отпуск", "Природа", "Лето", "Путешествия", "Вместе"],
  places: ["Море", "Горы", "Озеро", "Природа", "Наши места"],
  people: ["Наша семья"],
})) {
  items.forEach((name, i) =>
    entities.push({
      ...entities[0],
      id: kind + i,
      kind,
      name,
      cover:
        kind === "people"
          ? "/assets/family-hero.jpg"
          : "/assets/" + (i + 1) + ".jpg",
      latitude: kind === "places" ? [43.58, 46.85, 51.8, 55.75, 60.1][i] : null,
      longitude:
        kind === "places" ? [39.72, 9.53, 104.8, 37.61, 30.1][i] : null,
    }),
  );
}
const media: Media[] = Array.from({ length: 12 }, (_, i) => ({
  id: "demo" + i,
  space: "demo",
  owner: "demo",
  name: names[i % 6],
  mime: "image/jpeg",
  size: 0,
  width: 1200,
  height: 800,
  created: "2026-0" + ((i % 6) + 1) + "-12T12:00:00.000Z",
  deleted: null,
  entities: ["a" + (i % 6), "tags" + (i % 6), "places" + (i % 5), "people0"],
  favorite: i % 4 === 0,
  meta: {},
  demoSrc:
    i === 0 ? "/assets/family-hero.jpg" : "/assets/" + ((i % 6) + 1) + ".jpg",
}));
export const demo: State = {
  user: null,
  media,
  entities,
  spaces: [],
  members: [],
  notifications: [],
  bytes: 0,
};
