// Entry point, overlays, etc.

import * as Phaser from "phaser"
import * as Physics from "./physics"
import * as Game from "./game"

class Hud extends Phaser.GameObjects.Group {
  lives: Phaser.GameObjects.Sprite[]
  factories: Phaser.GameObjects.Sprite[]
  bombReloadBar: Phaser.GameObjects.Rectangle
  bombReloadSprite: Phaser.GameObjects.Sprite
  bombReloadWidth: number

  constructor(scene: Phaser.Scene, game: Game.Game) {
    super(scene)
    const camera = scene.cameras.main
    const pad = 0.01 * camera.displayWidth

    // Lives
    let offset = pad
    this.lives = []
    for (let i = 0; i < Game.S.playerLives; ++i) {
      const sprite = new Phaser.GameObjects.Sprite(
        scene,
        camera.displayWidth - offset,
        pad,
        "ship",
      ).setOrigin(1, 0)
      const size = 0.02 * camera.displayWidth
      sprite.setScale(size / sprite.width)
      this.lives.push(sprite)
      offset += pad + size
    }
    this.addMultiple(this.lives, /* addToScene */ true)

    // Factories
    offset = pad
    this.factories = []
    for (let i = 0; i < game.sim!.factories.alive.length; ++i) {
      const sprite = new Phaser.GameObjects.Sprite(
        scene,
        offset,
        pad,
        "factory",
      )
        .setOrigin(0, 0)
        .setFlipX(true)
      const size = 0.03 * camera.displayWidth
      sprite.setScale(size / sprite.width)
      this.factories.push(sprite)
      offset += pad + size
    }
    this.addMultiple(this.factories, /* addToScene */ true)

    // Bomb reload indicator
    this.bombReloadWidth =
      this.lives.length * (this.lives[0].displayWidth + pad) - pad
    this.bombReloadBar = new Phaser.GameObjects.Rectangle(
      scene,
      camera.displayWidth - pad,
      this.lives[0].displayHeight + 2 * pad,
      this.bombReloadWidth,
      0.015 * camera.displayHeight,
      0xffffffff,
    ).setOrigin(1, 0)
    this.add(this.bombReloadBar, /* addToScene */ true)

    this.bombReloadSprite = new Phaser.GameObjects.Sprite(
      scene,
      camera.displayWidth - pad - this.bombReloadWidth / 2,
      this.bombReloadBar.y + this.bombReloadBar.height / 2,
      "bomb",
    )
      .setTint(0xcc000000)
      .setAlpha(0.1)
      .setOrigin(0.5, 0.5)
      .setRotation(-Math.PI / 2)
    this.bombReloadSprite.setScale(
      (1.5 * this.bombReloadBar.displayHeight) / this.bombReloadSprite.height,
    )
    this.add(this.bombReloadSprite, /* addToScene */ true)
  }

  update(game: Game.Game): void {
    this.lives.forEach((life, i) => {
      life.setVisible(i < game.livesRemaining)
    })
    const factoryCount = game.factoryLiveCount()
    this.factories.forEach((factory, i) => {
      factory.setVisible(i < factoryCount)
    })
    const reload = game.sim!.ships.reload[0] / Physics.S.shipReloadTime
    this.bombReloadBar.setDisplaySize(
      this.bombReloadWidth * (1 - reload),
      this.bombReloadBar.displayHeight,
    )
    this.bombReloadSprite.setVisible(reload === 0)
  }
}

class UI extends Phaser.Scene {
  gameScene?: Game.Game
  hud?: Hud

  constructor() {
    super({ key: "ui" })
  }

  preload(): void {
    this.load.image("bomb", "bomb.png")
    this.load.image("factory", "factory.png")
    this.load.image("ship", "ship.png")
  }

  create(): void {
    this.scene.launch("game")
    this.scene.bringToTop()
    this.gameScene = this.scene.get("game") as Game.Game

    // Pause overlay
    const camera = this.cameras.main
    const pausedOverlay = this.add
      .rectangle(
        0,
        0,
        camera.displayWidth,
        camera.displayHeight,
        0xaa000000,
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
    this.gameScene.events.on("pause", () => {
      const victory = this.gameScene!.victory
      pausedText.setText(
        victory === null ? "paused" : victory ? "you win" : "you lose",
      )
      pausedText.setVisible(true)
      pausedOverlay.setVisible(true)
    })
    this.gameScene.events.on("resume", () => {
      pausedText.setVisible(false)
      pausedOverlay.setVisible(false)
    })

    // Menu controls
    this.input.keyboard!.on("keydown-SPACE", () => {
      const gameScene = this.gameScene!
      if (gameScene.victory === null) {
        if (gameScene.scene.isPaused()) {
          gameScene.scene.resume()
        } else {
          gameScene.scene.pause()
        }
      }
    })
    this.input.keyboard!.on("keydown-R", () => {
      this.gameScene!.scene.restart()
    })

    // HUD
    this.gameScene.events.on("create", () => {
      if (this.hud !== undefined) {
        this.hud.clear(/* removeFromScene */ true)
      }
      this.hud = new Hud(this, this.gameScene!)
    })
  }

  update(): void {
    this.hud?.update(this.gameScene!)
  }
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  width: 600,
  height: 600,
  scene: [UI, Game.Game],
})
