// Entry point, overlays, etc.

import * as Phaser from "phaser"
import * as Physics from "./physics"
import * as Game from "./game"
import { setLayoutFn } from "./lib/util"

class Hud extends Phaser.GameObjects.Group {
  lives: Phaser.GameObjects.Sprite[]
  factories: Phaser.GameObjects.Sprite[]
  bombReloadBar: Phaser.GameObjects.Rectangle
  bombReloadWidth: number

  constructor(scene: Phaser.Scene, game: Game.Game) {
    super(scene)

    // Lives
    this.lives = Array.from(Array(Game.S.playerLives)).map(() =>
      new Phaser.GameObjects.Sprite(scene, 0, 0, "ship").setOrigin(1, 0),
    )
    this.addMultiple(this.lives, /* addToScene */ true)

    // Factories
    this.factories = game.sim!.factories.alive.map(() =>
      new Phaser.GameObjects.Sprite(scene, 0, 0, "factory")
        .setOrigin(0, 0)
        .setFlipX(true),
    )
    this.addMultiple(this.factories, /* addToScene */ true)

    // Bomb reload indicator
    this.bombReloadWidth = 0
    this.bombReloadBar = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      0,
      1,
      1,
      0xffffffff,
    ).setOrigin(1, 0)
    this.add(this.bombReloadBar, /* addToScene */ true)

    // Layout
    setLayoutFn(scene, () => {
      const camera = this.scene.cameras.main
      const maxWH = Math.max(camera.displayWidth, camera.displayHeight)
      const pad = 0.0075 * maxWH

      // Lives
      let offset = pad
      this.lives.forEach((sprite) => {
        const size = 0.018 * maxWH
        sprite
          .setScale(size / sprite.width)
          .setPosition(camera.displayWidth - offset, pad)
        offset += pad + size
      })
      // Factories
      offset = pad
      this.factories.forEach((sprite) => {
        const size = 0.025 * maxWH
        sprite.setScale(size / sprite.width).setPosition(offset, pad)
        offset += pad + size
      })
      // Reload
      this.bombReloadWidth =
        this.lives.length * (this.lives[0].displayWidth + pad) - pad
      this.bombReloadBar
        .setPosition(
          camera.displayWidth - pad,
          this.lives[0].displayHeight + 2 * pad,
        )
        .setDisplaySize(this.bombReloadWidth, 0.018 * camera.displayHeight)
    })
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
    this.bombReloadBar.fillColor = reload === 0 ? 0xffffffff : 0xff888888
  }
}

class Overlay extends Phaser.GameObjects.Group {
  mainText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    super(scene)
    const background = new Phaser.GameObjects.Rectangle(
      scene,
      0,
      0,
      0,
      0,
      0xaa000000,
      0.0,
    ).setOrigin(0, 0)
    this.mainText = new Phaser.GameObjects.Text(scene, 0, 0, "paused", {
      color: "#fff",
      fontSize: "2em",
    }).setOrigin(0.5, 0.5)
    this.addMultiple([background, this.mainText], /* addToScene */ true)
    this.setVisible(false)
    setLayoutFn(scene, () => {
      const camera = this.scene.cameras.main
      background.setSize(camera.displayWidth, camera.displayHeight)
      this.mainText.setPosition(
        camera.displayWidth / 2,
        camera.displayHeight / 2,
      )
    })
  }
}

const PAUSE_TEXT =
  "(paused)\n" +
  "\n\n← ↓ → | A S D  : thrusters" +
  "\n\nV              : drop bomb" +
  "\n\n\nSPACE          : (un)pause" +
  "\n\nALT+ENTER      : fullscreen" +
  "\n\nCTRL+Z         : quit to main menu (lose progress)"

const VICTORY_TEXT = "victory!" + "\n\n\nSPACE : continue"

const DEFEAT_TEXT = "defeat." + "\n\n\nSPACE : try again"

const TIMEOUT_TEXT =
  "we can't keep this up,\nthis is madness..." +
  "\n\nwe need to SCALE." +
  "\n\n\nSPACE : continue"

export class UI extends Phaser.Scene {
  config?: Game.Config
  gameScene?: Game.Game
  hud?: Hud
  overlay?: Overlay

  constructor() {
    super({ key: "ui" })
  }

  preload(): void {
    this.load.image("factory", "factory.png")
    this.load.image("ship", "ship.png")
  }

  init(data: Record<string, any>): void {
    this.config = data as Game.Config
  }

  #returnToMenu(key: string): void {
    this.scene.start(key)
    this.scene.stop(this.gameScene)
  }

  create(): void {
    this.scene.launch("game", this.config)
    this.scene.bringToTop()
    this.gameScene = this.scene.get("game") as Game.Game

    // Pause overlay
    this.overlay = new Overlay(this)
    this.gameScene.events.on("pause", () => {
      const outcome = this.gameScene!.outcome
      const text = this.overlay?.mainText
      if (outcome === null) {
        text?.setText(PAUSE_TEXT)
      } else if (outcome === "victory") {
        text?.setText(VICTORY_TEXT)
      } else if (outcome === "defeat") {
        text?.setText(DEFEAT_TEXT)
      } else {
        text?.setText(TIMEOUT_TEXT)
      }
      this.overlay?.setVisible(true)
    })
    this.gameScene.events.on("resume", () => {
      this.overlay?.setVisible(false)
    })

    // Menu controls
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      const gameScene = this.gameScene!

      if (e.key === " ") {
        if (gameScene.outcome === null) {
          if (gameScene.scene.isPaused()) {
            gameScene.scene.resume()
          } else {
            gameScene.scene.pause()
          }
        } else if (gameScene.scene.isPaused()) {
          if (gameScene.outcome === "defeat") {
            gameScene.scene.restart()
          } else {
            // victory | timeout
            if (this.config!.storyMode) {
              const story = this.scene.get("story")
              this.scene.stop()
              gameScene.scene.stop()
              story.scene.resume()
              story.scene.setVisible(true)
            } else {
              this.#returnToMenu("menu-freeplay")
            }
          }
        }
      }

      if (e.altKey || e.metaKey) {
        if (e.key === "Enter") {
          if (this.scale.isFullscreen) {
            this.scale.stopFullscreen()
          } else {
            this.scale.startFullscreen()
          }
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          this.#returnToMenu("menu")
        }
      }

      if (e.altKey) {
        // Secret hotkeys
        if (e.key === "p") {
          gameScene.outcome = "victory"
          gameScene.scene.pause()
        }
        if (e.key === "o") {
          gameScene.outcome = "defeat"
          gameScene.scene.pause()
        }
        if (e.key === "i") {
          gameScene.outcome = "timeout"
          gameScene.scene.pause()
        }
        if (e.key === "u") {
          gameScene.scene.restart()
        }
      }
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
