export interface Level {
  key: string
  title: string
  text?: string
  timeout?: number
  infiniteLives?: boolean
}

export const LEVELS: Level[] = [
  {
    key: "a0",
    title: "First steps",
    text:
      "Your first day? Great, another one." +
      "\nI'll keep it simple, then..." +
      "\n 1) DON'T CRASH" +
      "\n 2) DESTROY all the factories",
    infiniteLives: true,
  },
  { key: "a1", title: "Exploration" },
  { key: "a2", title: "Firing back" },
  { key: "a3", title: "Getting serious" },
  { key: "a4", title: "Getting serious-er" },
  { key: "a5", title: "Getting serious-er-er" },
  {
    key: "b",
    title: "Making it count",
    timeout: 120,
  },
  { key: "c0", title: "Friends!" },
  { key: "c1", title: "Working together" },
  { key: "c2", title: "Working together-er" },
  { key: "c3", title: "Working together-er-er" },
  { key: "d", title: "Making it count (again)" },
]
