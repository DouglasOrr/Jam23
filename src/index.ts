// Entry point, overlays, etc.

import * as Phaser from "phaser"
import Game from "./game"

class UI extends Phaser.Scene {
  constructor() {
    super({ key: "ui" })
  }

  create(): void {
    this.scene.launch("game")
    this.scene.bringToTop()
    const camera = this.cameras.main
    const pausedText = this.add
      .text(camera.displayWidth / 2, camera.displayHeight / 2, "paused", {
        color: "#fff",
        fontSize: "2em",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false)
    this.input.keyboard!.on("keydown-SPACE", () => {
      const mainScene = this.scene.get("game").scene
      if (mainScene.isPaused()) {
        mainScene.resume()
        pausedText.setVisible(false)
      } else {
        mainScene.pause()
        pausedText.setVisible(true)
      }
    })
  }
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  width: 600,
  height: 600,
  scene: [UI, Game],
})
