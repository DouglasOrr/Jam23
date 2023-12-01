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
      "Your first day? GREAT: we always needed another pilot" +
      "\nwho doesn't know their retro thruster from their elbow." +
      "\n\nI'll keep it simple, then..." +
      "\n 1) DON'T CRASH" +
      "\n 2) DESTROY all the factories",
    infiniteLives: true,
  },
  {
    key: "a1",
    title: "Exploration",
    text:
      "I'm sure you enjoyed messing around. Well done YOU. But there's" +
      "\nwork to be done: many Coalition Of Auspicious Logistics" +
      "\nfactories still operate. Go to it.",
  },
  {
    key: "a2",
    title: "Firing back",
    text:
      "Not bad. Easy to hit things when nothing's trying to hit" +
      "\nyou back, right?",
  },
  {
    key: "a3",
    title: "Getting serious",
    text:
      "I love the way they light up the sky when they EXPLODE!" +
      "\nYou know the atmospheres here used to be breathable. Maybe" +
      "\none day...",
  },
  {
    key: "a4",
    title: "Getting serious-er",
    text:
      "OK, I've got to admit it, you're pretty good at this." +
      "\nTell me, when is x^2 - 35 x = 294 ?" +
      "\n\nSorry, just curious how you do it; don't mind me." +
      "\nBut in all serious, please BE CAREFUL, intel warns that" +
      "\nCOAL has developed a more advanced ground-to-air system.",
  },
  {
    key: "a5",
    title: "Getting serious-er-er",
    text:
      "Poetry in parabolic motion! You play Newton's second law" +
      "\nlike a concert piano, and it's time for your career defining" +
      "\nrecital, a tour-de-force in tri-nitro-totulene.",
  },
  {
    key: "b",
    title: "The eye of the storm",
    timeout: 120,
    text:
      "I'm in tears, that was truly beautiful." +
      "\n\nThe higher-ups have spoken; they want you to head into" +
      "\nthe eye of the storm." +
      "\nTo level with you, I'm not sure how I feel about this" +
      "\nbut we all have our orders. Give it your BEST!",
  },
  {
    key: "c0",
    title: "Friends!",
    text:
      "Not your fault. Not YOUR fault." +
      "\nTell you what, though, I had a word or two for those" +
      "\npencil-pushers who sent you in." +
      "\n\nStill, to take on that level of threat, we need fresh tactics." +
      "\nWe need to scale your skills. Our prompt engineers have developed" +
      "\na new flying robot, using Tiresome Imitation Near You technology." +
      "\nLearn to use it quickly." +
      "\n\n(Oh, and don't worry about losing the odd TINY robot, we've" +
      "\nbuilt THOUSANDS.)",
  },
  {
    key: "c1",
    title: "Working together",
    text: "Dumb, aren't they.   (But kindof cute.)" + "\nKeep up the training!",
  },
  {
    key: "c2",
    title: "Working together-er",
    text:
      "That's looking quite promising. I think it's" +
      "\ntime to push beyond what we could do ALONE." +
      "\n\nCannon-fodder or treasured wingmen... your choice.",
  },
  {
    key: "c3",
    title: "Working together-er-er",
    text:
      "Boom boom boom boom," +
      "\nBoom boom boom boom," +
      "\nBoom boom boom boom," +
      "\n ... Boom boom boom." +
      "\n\nMore, MORE! Make them EXPLODE.",
  },
  {
    key: "d",
    title: "The eye of the storm (again)",
    text:
      "This is it, we're back here." +
      "\n\nWe've massively increased the number of concurrent TINYs." +
      "\nYou've got everything we have." +
      "\n\nYour solo recital was beautiful. Now I want to hear a" +
      "\nPOWERFUL chorus, a crescendo that builds to a rumbling" +
      "\nROAR of victory. Play, PLAY!",
  },
]

export const FINAL_SCREEN = {
  title: "You {played, flew, scaled} & YOU CONQUERED!",
  text:
    "I can't believe it, you've done it!" +
    "\n\nWell not just you," +
    "\n\n   you can fly with a TINY help from your friends" +
    "\n   ..." +
    "\n   ..." +
    "\n\n\n\nUrm, yep... take the weekend off — you deserve it!",
}
