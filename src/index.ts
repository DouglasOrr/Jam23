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
    const gameScene = this.scene.get("game")

    const camera = this.cameras.main
    const pausedOverlay = this.add
      .rectangle(
        0,
        0,
        camera.displayWidth,
        camera.displayHeight,
        0x88000000,
        0.0,
      )
      .setOrigin(0, 0)
      .setVisible(false)
    const pausedText = this.add
      .text(camera.displayWidth / 2, camera.displayHeight / 2, "paused", {
        color: "#fff",
        fontSize: "2em",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false)
    gameScene.events.on("pause", () => {
      const victory = (gameScene as Game).victory
      pausedText.setText(
        victory === null ? "paused" : victory ? "you win" : "you lose",
      )
      pausedText.setVisible(true)
      pausedOverlay.setVisible(true)
    })
    gameScene.events.on("resume", () => {
      pausedText.setVisible(false)
      pausedOverlay.setVisible(false)
    })
    this.input.keyboard!.on("keydown-SPACE", () => {
      if (gameScene.scene.isPaused()) {
        gameScene.scene.resume()
      } else {
        gameScene.scene.pause()
      }
    })
    this.input.keyboard!.on("keydown-R", () => {
      gameScene.scene.restart()
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
