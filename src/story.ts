export interface Level {
  key: string
  title: string
  impossible?: boolean
}

export interface Dialogue {
  text: string
}

type Stage = Level | Dialogue

export const levels: Stage[] = [
  {
    text:
      "Your first day? Great, another one." +
      "\nI'll keep it simple, then..." +
      "\nDON'T CRASH & DESTROY all the factories",
  },
  { key: "a0", title: "First steps" },
  { key: "a1", title: "Exploration" },
  { key: "a2", title: "Firing back" },
  { key: "a3", title: "Getting serious" },
  { key: "a4", title: "Getting serious-er" },
  { key: "a5", title: "Getting serious-er-er" },
  {
    key: "b",
    title: "Making it count",
    impossible: true,
  },
  { key: "c0", title: "Friends!" },
  { key: "c1", title: "Working together" },
  { key: "c2", title: "Working together-er" },
  { key: "c3", title: "Working together-er-er" },
  { key: "d", title: "Making it count (again)" },
]
