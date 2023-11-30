import { UI } from "./ui"
import { Game } from "./game"

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  backgroundColor: "#000000",
  scene: [UI, Game],
})
