// The scene that runs the main game, including all the display logic

import * as Phaser from "phaser"
import * as Physics from "./physics"
import ScriptAgent from "./scriptagent"

export const S = {
  fov: 75,
  bulletRadius: 0.2,
  factoryWidth: 7,
  friendlyAlpha: 0.4,
  playerLives: 4,
}

interface SimUpdate {
  update: (sim: Physics.Sim) => void
}

class Ship extends Phaser.GameObjects.Container implements SimUpdate {
  index: number
  burnLeft: Phaser.GameObjects.Particles.ParticleEmitter
  burnRight: Phaser.GameObjects.Particles.ParticleEmitter
  burnRetro: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    super(scene)
    this.index = index
    this.add(
      this.scene.add
        .image(0, 0, "ship")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(Physics.S.shipSize, Physics.S.shipSize)
        .setFlipY(true)
        .setAlpha(this.index === 0 ? 1 : S.friendlyAlpha),
    )
    this.burnLeft = this.#addBurner("left")
    this.burnRight = this.#addBurner("right")
    this.burnRetro = this.#addBurner("retro")
    this.update(sim)
  }

  #addBurner(
    kind: "left" | "right" | "retro",
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const off = { left: 1, retro: 0, right: -1 }[kind]
    const angle =
      kind === "retro"
        ? { min: -180, max: 0 }
        : { min: -90 + 10 * off, max: -90 }
    const emitter = this.scene.add.particles(0.6 * off, -1.4, "smoke", {
      lifespan: 400,
      scale: { start: 0.02, end: 0.0, ease: "sine.in" },
      angle,
      speed: 15,
      blendMode: "ADD",
      frequency: 15,
      alpha: this.index === 0 ? 1 : S.friendlyAlpha ** 2,
    })
    this.add(emitter)
    return emitter
  }

  update(sim: Physics.Sim): void {
    this.setVisible(sim.ships.alive[this.index])
    const position = sim.ships.position[this.index]
    this.setPosition(position[0], position[1])
    this.setRotation(sim.ships.angle[this.index])
    const control = sim.ships.control[this.index]
    this.burnLeft.emitting = control.left
    this.burnRight.emitting = control.right
    this.burnRetro.emitting = control.retro
  }
}

class Factory implements SimUpdate {
  index: number
  factory: Phaser.GameObjects.Sprite
  smoke: Phaser.GameObjects.Particles.ParticleEmitter

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    this.index = index
    const position = sim.factories.position[index]
    const angle = sim.factories.angle[index]
    const w = S.factoryWidth
    const h = S.factoryWidth * 0.75
    this.factory = scene.add
      .sprite(position[0], position[1], "factory")
      .setDisplaySize(w, h * 0.75)
      .setOrigin(0.5, 0.2)
      .setFlipY(true)
      .setTint(0x555555)
      .setRotation(sim.factories.angle[index])
    const fx = 0.35 // 0.5=left, 0=centre
    const smokex =
      position[0] + fx * w * Math.cos(angle) - 0.8 * h * Math.sin(angle)
    const smokey =
      position[1] + fx * w * Math.sin(angle) + 0.8 * h * Math.cos(angle)
    const smokeAngleDeg = ((angle + Math.PI / 2) * 180) / Math.PI
    this.smoke = scene.add.particles(smokex, smokey, "smoke", {
      blendMode: "NORMAL",
      lifespan: 8000,
      speed: 0.5,
      angle: { min: smokeAngleDeg - 15, max: smokeAngleDeg + 15 },
      frequency: 4000,
      scale: { start: 0.025, end: 0.04, ease: "cube-in" },
      alpha: { start: 1, end: 0, ease: "cube-in" },
    })
  }

  update(sim: Physics.Sim): void {
    const alive = sim.factories.alive[this.index]
    this.factory.setVisible(alive)
    this.smoke.emitting = alive
  }
}

class Turret implements SimUpdate {
  index: number
  body: Phaser.GameObjects.Shape
  gun: Phaser.GameObjects.Line

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    this.index = index
    const position = sim.turrets.position[this.index]
    this.body = scene.add.circle(position[0], position[1], 1, 0xffffffff)
    this.gun = scene.add
      .line(
        position[0],
        position[1],
        0,
        0,
        0,
        Physics.S.turretLength,
        0xffffffff,
      )
      .setRotation(sim.turrets.turretAngle[this.index])
      .setLineWidth(0.2)
      .setOrigin(0, 0)
  }

  update(sim: Physics.Sim): void {
    this.body.setVisible(sim.turrets.alive[this.index])
    this.gun
      .setRotation(sim.turrets.turretAngle[this.index])
      .setVisible(sim.turrets.alive[this.index])
  }
}

class Bullets implements SimUpdate {
  bullets: Phaser.GameObjects.Shape[] = []

  constructor(scene: Phaser.Scene, sim: Physics.Sim) {
    for (let i = 0; i < sim.bullets.position.length; ++i) {
      this.bullets.push(scene.add.circle(0, 0, S.bulletRadius, 0xffffffff))
    }
  }

  update(sim: Physics.Sim): void {
    for (let i = 0; i < sim.bullets.position.length; ++i) {
      const bullet = this.bullets[i]
      bullet.setVisible(0 < sim.bullets.timeToLive[i])
      const position = sim.bullets.position[i]
      bullet.setPosition(position[0], position[1])
    }
  }
}

class Bombs implements SimUpdate {
  bombs: Phaser.GameObjects.Sprite[] = []

  constructor(scene: Phaser.Scene, sim: Physics.Sim) {
    for (let i = 0; i < sim.bombs.position.length; ++i) {
      this.bombs.push(
        scene.add
          .sprite(0, 0, "bomb")
          .setDisplaySize(Physics.S.bombSize, Physics.S.bombSize),
      )
    }
  }

  update(sim: Physics.Sim): void {
    for (let i = 0; i < sim.bombs.position.length; ++i) {
      const position = sim.bombs.position[i]
      const velocity = sim.bombs.velocity[i]
      this.bombs[i]
        .setVisible(0 < sim.bombs.timeToLive[i])
        .setAlpha(sim.bombs.owner[i] === 0 ? 1.0 : S.friendlyAlpha)
        .setPosition(position[0], position[1])
        .setRotation(Math.atan2(velocity[0], -velocity[1]))
    }
  }
}

function downloadJSON(data: Record<string, unknown>, name: string): void {
  const a = document.createElement("a")
  a.href =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data))
  a.download = name
  a.click()
  a.remove()
}

class KeyboardControl implements SimUpdate {
  index: number
  controls: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
    V: Phaser.Input.Keyboard.Key
  }

  constructor(scene: Phaser.Scene, index: number, sim: Physics.Sim) {
    this.index = index
    const keyboard = scene.input.keyboard!
    this.controls = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      A: keyboard.addKey("a"),
      S: keyboard.addKey("s"),
      D: keyboard.addKey("d"),
      V: keyboard.addKey("v"),
    }
    keyboard.on("keydown-P", () => {
      downloadJSON(sim.log, "log.json")
    })
  }

  update(sim: Physics.Sim): void {
    const shipControl = sim.ships.control[this.index]
    shipControl.left = this.controls.left.isDown || this.controls.A.isDown
    shipControl.retro = this.controls.down.isDown || this.controls.S.isDown
    shipControl.right = this.controls.right.isDown || this.controls.D.isDown
    shipControl.dropBomb = this.controls.V.isDown
  }
}

export interface Config extends Physics.Config {
  level: string
}

export class Game extends Phaser.Scene {
  config?: Config
  sim?: Physics.Sim
  controllers: SimUpdate[] = []
  updaters: SimUpdate[] = []
  playerShip?: Ship
  physicsTimeOverflow: number = 0
  livesRemaining: number = 0
  victory: boolean | null = null

  factoryLiveCount(): number {
    return this.sim!.factories.alive.reduce((n, alive) => n + +alive, 0)
  }

  constructor() {
    super({ key: "game" })
  }

  init(data: Record<string, any>): void {
    this.config = data as Config
  }

  preload(): void {
    this.load.image("bomb", "bomb.png")
    this.load.image("factory", "factory.png")
    this.load.json("level", `levels/${this.config!.level}.json`)
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
  }

  create(): void {
    this.sim = new Physics.Sim(this.cache.json.get("level"), this.config!)
    this.physicsTimeOverflow = 0
    this.livesRemaining = S.playerLives
    this.victory = null
    this.controllers = []
    this.updaters = []

    // Ship
    const ships = this.sim.ships.position.map((_, i) =>
      this.add.existing(new Ship(this, this.sim!, i)),
    )
    this.playerShip = ships[0]
    this.updaters.push(...ships)

    // Level
    for (let i = 0; i < this.sim.factories.position.length; ++i) {
      this.updaters.push(new Factory(this, this.sim, i))
    }
    for (let i = 0; i < this.sim.turrets.position.length; ++i) {
      this.updaters.push(new Turret(this, this.sim, i))
    }
    const xy: number[][] = []
    this.sim.planet.height.forEach((r: number, i: number) => {
      const theta = (2 * Math.PI * i) / (this.sim!.planet.height.length - 1)
      xy.push([r * Math.sin(theta), -r * Math.cos(theta)])
    })
    this.add.polygon(0, 0, xy, 0xff888888).setOrigin(0, 0)
    this.updaters.push(new Bullets(this, this.sim))
    this.updaters.push(new Bombs(this, this.sim))

    // Control
    this.controllers.push(new KeyboardControl(this, 0, this.sim))
    for (let i = 1; i < this.sim.ships.position.length; ++i) {
      this.controllers.push(new ScriptAgent(i))
    }
    // this.controllers.push(
    //   new Agent.LearningAgent(
    //     [...Array(this.sim.ships.position.length - 1)].map((_, i) => i + 1),
    //     0,
    //   ),
    // )

    // Camera
    this.#updateCamera(true)
    this.scale.on("resize", () => {
      this.#updateCamera(true)
    })

    this.scene.pause()
  }

  #updateCamera(init: boolean): void {
    const camera = this.cameras.main
    const shipPosition = this.sim!.ships.position[0]
    const rotation = Math.atan2(-shipPosition[0], -shipPosition[1])
    camera
      .setZoom(Math.min(camera.width / S.fov, camera.height / S.fov))
      .setRotation(rotation)
      .setFollowOffset(-10 * Math.sin(rotation), -10 * Math.cos(rotation))
    if (init) {
      camera.startFollow(
        this.playerShip!,
        false,
        0.05,
        0.05,
        camera.followOffset.x,
        camera.followOffset.y,
      )
    }
  }

  update(_time: number, delta: number): void {
    this.physicsTimeOverflow += delta / 1000
    if (this.sim !== undefined) {
      // Control
      this.controllers.forEach((x) => {
        x.update(this.sim!)
      })
      // Physics
      const events = new Physics.Events()
      while (this.physicsTimeOverflow >= Physics.S.dt) {
        this.sim.update(events)
        this.physicsTimeOverflow -= Physics.S.dt
      }
      // Outcome
      this.livesRemaining -= +events.playerDeath
      if (this.victory === null) {
        if (this.livesRemaining === 0 || this.factoryLiveCount() === 0) {
          this.victory = this.livesRemaining !== 0
          this.time.delayedCall(1500, () => {
            this.scene.pause()
          })
        }
      }
      // Graphics
      this.updaters.forEach((x) => {
        x.update(this.sim!)
      })
      events.explosions.forEach((position) => {
        this.add.particles(position[0], position[1], "smoke", {
          blendMode: "ADD",
          lifespan: 500,
          speed: 11,
          frequency: 1,
          duration: 350,
          scale: { start: 0.01, end: 0.06, ease: "cube.out" },
          alpha: { start: 0.4, end: 0, ease: "cube.out" },
        })
      })
      this.#updateCamera(false)
    }
  }
}
