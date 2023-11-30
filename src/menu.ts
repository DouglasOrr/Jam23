import * as Phaser from "phaser"
import type * as Game from "./game"
import * as Story from "./story"

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
      impossible: (p.get("impossible") ?? "false") === "true",
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

function setLayout(scene: Phaser.Scene, fn: () => void): void {
  fn()
  scene.scale.on("resize", () => {
    if (scene.scene.isActive()) {
      fn()
    }
  })
}

class BaseMenu extends Phaser.Scene {
  create(): void {
    this.input.keyboard!.on("keydown-ENTER", (e: KeyboardEvent) => {
      if (e.altKey) {
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
          console.log("play")
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
        key: "O",
        action: () => {
          this.scene.start("menu-credits")
        },
      },
    ]
    const buttons = options.map((x) =>
      this.add.existing(createTextButton(this, x).setOrigin(0, 0.5)),
    )
    setLayout(this, () => {
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
    setLayout(this, () => {
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
    const levels = Story.levels.filter((s) => "key" in s) as Story.Level[]
    const buttons = levels.map((level: Story.Level, i: number) =>
      this.add.existing(
        createTextButton(this, {
          title:
            level.title + (level.impossible ?? false ? " (IMPOSSIBLE)" : ""),
          key: String.fromCharCode(65 + i),
          action: () => {
            this.scene.start("ui", {
              level: level.key,
              startPosition: 0,
              impossible: level.impossible ?? false,
              immortal: false,
            })
          },
        }).setOrigin(0, 0),
      ),
    )
    const backButton = this.add.existing(createBackButton(this).setOrigin(0, 0))
    setLayout(this, () => {
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
