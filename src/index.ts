import { UI } from "./ui"
import { Game } from "./game"
import * as Menu from "./menu"

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  backgroundColor: "#000000",
  scene: [Menu.Menu, Menu.Credits, Menu.Freeplay, UI, Game],
})
