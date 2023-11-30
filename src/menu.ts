import * as Phaser from "phaser"
import type * as Game from "./game"
import { LEVELS } from "./story"
import { setLayoutFn } from "./lib/util"

const S = {
  vpad: 0.05,
  hpad: 0.1,
  fontStyle: {
    color: "#fff",
    fontSize: "2em",
  },
}

function getDevConfig(): Game.Config | null {
  const p = new URLSearchParams(window.location.search)
  if (p.has("level")) {
    return {
      level: p.get("level") as string,
      startPosition: Number(p.get("start") ?? 0),
      immortal: (p.get("immortal") ?? "false") === "true",
      storyMode: false,
      timeout: 0,
      infiniteLives: false,
    }
  } else return null
}

interface MenuOption {
  title: string
  key: string
  action: () => void
}

function createTextButton(
  scene: Phaser.Scene,
  spec: MenuOption,
): Phaser.GameObjects.Text {
  scene.input.keyboard?.on(`keydown-${spec.key}`, spec.action)
  return new Phaser.GameObjects.Text(
    scene,
    0,
    0,
    `${spec.title} (${spec.key})`,
    S.fontStyle,
  )
    .setInteractive()
    .on("pointerdown", spec.action)
}

class BaseMenu extends Phaser.Scene {
  create(): void {
    this.input.keyboard!.on("keydown-ENTER", (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen()
        } else {
          this.scale.startFullscreen()
        }
      }
    })
    this.input.on(
      "pointerover",
      (_: any, obj: Phaser.GameObjects.GameObject[]) => {
        ;(obj[0] as Phaser.GameObjects.Text).setStyle({ fontStyle: "bold" })
      },
    )
    this.input.on(
      "pointerout",
      (_: any, obj: Phaser.GameObjects.GameObject[]) => {
        ;(obj[0] as Phaser.GameObjects.Text).setStyle({ fontStyle: "normal" })
      },
    )
  }
}

export class Menu extends BaseMenu {
  constructor() {
    super({ key: "menu" })
  }

  create(): void {
    const devConfig = getDevConfig()
    if (devConfig !== null) {
      this.scene.start("ui", devConfig)
    }
    const options = [
      {
        title: "Play",
        key: "P",
        action: () => {
          this.scene.start("story")
        },
      },
      {
        title: "Browse / Freeplay",
        key: "L",
        action: () => {
          this.scene.start("menu-freeplay")
        },
      },
      {
        title: "Credits",
        key: "K",
        action: () => {
          this.scene.start("menu-credits")
        },
      },
    ]
    const buttons = options.map((x) =>
      this.add.existing(createTextButton(this, x).setOrigin(0, 0.5)),
    )
    setLayoutFn(this, () => {
      const camera = this.cameras.main
      const vpad = S.vpad * camera.displayHeight
      const hpad = S.hpad * camera.displayWidth
      buttons.forEach((button, i) => {
        button.setPosition(
          hpad,
          0.25 * camera.displayHeight + i * (vpad + button.displayHeight),
        )
      })
    })
    super.create()
  }
}

// Submenus

function createBackButton(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return createTextButton(scene, {
    title: "Main menu",
    key: "Z",
    action: () => {
      scene.scene.start("menu")
    },
  })
}

const CREDITS_TEXT =
  "Credits" +
  "\n\n  Phaser 3 : game library" +
  "\n\n  vscode   : development IDE"

export class Credits extends BaseMenu {
  constructor() {
    super({ key: "menu-credits" })
  }

  create(): void {
    const text = this.add.text(0, 0, CREDITS_TEXT, S.fontStyle)
    const backButton = this.add.existing(createBackButton(this).setOrigin(0, 0))
    setLayoutFn(this, () => {
      const camera = this.cameras.main
      const vpad = S.vpad * camera.displayHeight
      const hpad = S.hpad * camera.displayWidth
      text.setPosition(hpad, vpad)
      backButton.setPosition(hpad, vpad + text.displayHeight + vpad)
    })
    super.create()
  }
}

export class Freeplay extends BaseMenu {
  constructor() {
    super({ key: "menu-freeplay" })
  }

  create(): void {
    const buttons = LEVELS.map((level, i) =>
      this.add.existing(
        createTextButton(this, {
          title:
            level.title + (level.timeout !== undefined ? " (IMPOSSIBLE)" : ""),
          key: String.fromCharCode(65 + i),
          action: () => {
            this.scene.start("ui", {
              level: level.key,
              startPosition: 0,
              storyMode: false,
              infiniteLives: false,
              timeout: 0,
              immortal: false,
            })
          },
        }).setOrigin(0, 0),
      ),
    )
    const backButton = this.add.existing(createBackButton(this).setOrigin(0, 0))
    setLayoutFn(this, () => {
      const camera = this.cameras.main
      const vpad = S.vpad * camera.displayHeight
      const hpad = S.hpad * camera.displayWidth
      const marginRatio = 2
      buttons.forEach((button, i) => {
        button.setPosition(hpad, vpad + i * button.displayHeight * marginRatio)
      })
      backButton.setPosition(
        hpad,
        vpad + buttons.length * buttons[0].displayHeight * marginRatio + vpad,
      )
    })
    super.create()
  }
}

// Story

const FINISHED = {
  title: "Congratulations!",
  text:
    "You've done it. Not just you, of course." +
    "\nBut well done anyway." +
    "\nTake the weekend off, you deserve it!",
}

export class Story extends BaseMenu {
  index?: number = 0

  constructor() {
    super({ key: "story" })
  }

  create(): void {
    const title = this.add
      .text(0, 0, "", {
        color: "#fff",
        fontSize: "2.5em",
      })
      .setOrigin(0, 0)
    const body = this.add
      .text(0, 0, "", { color: "#fff", fontSize: "2em" })
      .setOrigin(0, 0)
    const continueButton = this.add.existing(
      createTextButton(this, {
        title: "Continue",
        key: "SPACE",
        action: () => {
          if (this.index! < LEVELS.length) {
            const level = LEVELS[this.index!]
            this.scene.launch("ui", {
              level: level.key,
              startPosition: 0,
              storyMode: true,
              infiniteLives: level.infiniteLives ?? false,
              timeout: level.timeout ?? 0,
              immortal: false,
            })
            this.scene.setVisible(false)
            this.scene.pause()
          } else {
            this.scene.start("menu")
          }
        },
      }),
    )

    this.index = -1
    const updateContents = (): void => {
      this.index! += 1
      if (this.index! < LEVELS.length) {
        const level = LEVELS[this.index!]
        title.setText(level.title)
        body.setText((level.text ?? "").replaceAll("\n", "\n\n"))
      } else {
        title.setText(FINISHED.title)
        body.setText(FINISHED.text)
      }
    }
    updateContents()
    this.events.on("resume", updateContents)
    this.events.once("shutdown", () => {
      this.events.removeListener("resume", updateContents)
    })
    setLayoutFn(this, () => {
      const camera = this.cameras.main
      const pad = 0.05 * Math.min(camera.displayWidth, camera.displayHeight)
      title.setPosition(pad, pad)
      body.setPosition(pad, 2 * pad + title.displayHeight)
      continueButton.setPosition(pad, body.y + body.displayHeight + pad)
    })
    super.create()
  }
}
