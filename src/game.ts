// The scene that runs the main game, including all the display logic

import * as Phaser from "phaser"
import * as Physics from "./physics"
import ScriptAgent from "./scriptagent"
import { setLayoutFn } from "./lib/util"

export const S = {
  fov: 75,
  bulletRadius: 0.2,
  factoryWidth: 7,
  playerTint: 0xffe0e0e0,
  friendlyTint: 0xff777777,
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
    const scale = this.index === 0 ? 1.03 : 0.97
    this.add(
      this.scene.add
        .image(0, 0, "ship")
        .setOrigin(0.5, 0.5)
        .setDisplaySize(scale * Physics.S.shipSize, scale * Physics.S.shipSize)
        .setFlipY(true)
        .setTint(this.index === 0 ? S.playerTint : S.friendlyTint),
    )
    this.burnLeft = this.#addBurner("left")
    this.burnRight = this.#addBurner("right")
    this.burnRetro = this.#addBurner("retro")
    this.update(sim)
    this.setDepth(-this.index)
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
      tint: this.index === 0 ? 0xffffffff : 0xff222222,
      alpha: 0.5,
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
  body: Phaser.GameObjects.Sprite
  gun: Phaser.GameObjects.Sprite

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    this.index = index
    const position = sim.turrets.position[this.index]
    const tint = 0xffaaaaaa
    this.gun = scene.add
      .sprite(
        position[0],
        position[1],
        `barrel${sim.turrets.level[this.index]}`,
      )
      .setDisplaySize((3 / 8) * Physics.S.turretLength, Physics.S.turretLength)
      .setRotation(sim.turrets.turretAngle[this.index])
      .setOrigin(0.5, 0)
      .setTint(tint)
    this.body = scene.add
      .sprite(position[0], position[1], "turret")
      .setOrigin(0.5, 0.5)
      .setDisplaySize(1.7, 1.7)
      .setRotation(sim.turrets.angle[this.index])
      .setTint(tint)
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
        .setTint(sim.bombs.owner[i] === 0 ? S.playerTint : S.friendlyTint)
        .setPosition(position[0], position[1])
        .setRotation(Math.atan2(velocity[0], -velocity[1]))
    }
  }
}

class Explosions {
  emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  update(scene: Phaser.Scene, explosions: Physics.Vec2[]): void {
    const config = {
      blendMode: "ADD",
      lifespan: 500,
      speed: 11,
      frequency: 1,
      duration: 350,
      scale: { start: 0.01, end: 0.06, ease: "cube.out" },
      alpha: { start: 0.4, end: 0, ease: "cube.out" },
    }
    const finishedEmitters = this.emitters.filter(
      (e) =>
        scene.time.now - e.getData("startTime") >
        config.lifespan + config.duration,
    )
    explosions.forEach((position) => {
      if (finishedEmitters.length === 0) {
        const newEmitter = scene.add.particles(0, 0, "smoke", config)
        this.emitters.push(newEmitter)
        finishedEmitters.push(newEmitter)
      }
      finishedEmitters
        .pop()!
        .setPosition(position[0], position[1])
        .setData("startTime", scene.time.now)
        .start()
    })
  }
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
  storyMode: boolean
  infiniteLives: boolean
  timeout: number
}

export class Game extends Phaser.Scene {
  config?: Config
  levelKey?: string
  sim?: Physics.Sim
  controllers: SimUpdate[] = []
  updaters: SimUpdate[] = []
  playerShip?: Ship
  explosions?: Explosions
  physicsTimeOverflow: number = 0
  livesRemaining: number = 0
  outcome: "victory" | "defeat" | "timeout" | null = null

  factoryLiveCount(): number {
    return this.sim!.factories.alive.reduce((n, alive) => n + +alive, 0)
  }

  constructor() {
    super({ key: "game" })
  }

  init(data: Record<string, any>): void {
    this.config = data as Config
    this.levelKey = `level-${this.config.level}`
  }

  preload(): void {
    this.load.image("barrel0", "barrel0.png")
    this.load.image("barrel1", "barrel1.png")
    this.load.image("barrel2", "barrel2.png")
    this.load.image("barrel3", "barrel3.png")
    this.load.image("bomb", "bomb.png")
    this.load.image("factory", "factory.png")
    this.load.json(this.levelKey!, `levels/${this.config!.level}.json`)
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
    this.load.image("turret", "turret.png")

    this.load.audio("explosion", "explosion.mp3")
  }

  create(): void {
    this.sim = new Physics.Sim(
      this.cache.json.get(this.levelKey!),
      this.config!,
    )
    this.physicsTimeOverflow = 0
    this.livesRemaining = S.playerLives * +!this.config!.infiniteLives
    this.outcome = null
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
    const planetHeight = this.sim.planet.height
    const planetSpacing = this.sim.planet.spacing
    planetHeight.forEach((r0: number, i: number) => {
      const theta = (2 * Math.PI * i) / (planetHeight.length - 1)
      xy.push([r0 * Math.sin(theta), r0 * -Math.cos(theta)])
      if (i < planetHeight.length - 1) {
        const nSub = 6
        const dr = (planetHeight[i + 1] - r0) / (nSub + 1)
        const dtheta = (2 * Math.PI) / ((planetHeight.length - 1) * (nSub + 1))
        for (let j = 1; j <= nSub; ++j) {
          const rj = r0 + dr * j + 0.06 * planetSpacing * (Math.random() - 0.5)
          const tj = theta + dtheta * (j + 0.6 * (Math.random() - 0.5))
          xy.push([rj * Math.sin(tj), rj * -Math.cos(tj)])
        }
      }
    })
    this.add.polygon(0, 0, xy, 0xff303030).setOrigin(0, 0)
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

    this.explosions = new Explosions()

    // Camera
    setLayoutFn(this, () => {
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

  #setOutcome(outcome: "victory" | "defeat" | "timeout"): void {
    this.outcome = outcome
    this.time.delayedCall(1500, () => {
      this.scene.pause()
    })
  }

  update(time: number, delta: number): void {
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
      this.livesRemaining -= +events.playerDeath * +!this.config!.infiniteLives
      if (this.outcome === null) {
        if (this.factoryLiveCount() === 0) {
          this.#setOutcome("victory")
        }
        const hasTimeout = this.config?.timeout !== 0
        if (this.livesRemaining === 0 && !this.config!.infiniteLives) {
          // If timeout is set, we assume the fight is "impossible", so all defeat outcomes
          // become timeouts
          this.#setOutcome(hasTimeout ? "timeout" : "defeat")
        }
        if (
          hasTimeout &&
          (time - this.time.startTime) / 1000 >= this.config!.timeout
        ) {
          this.#setOutcome("timeout")
        }
      }
      // Graphics
      this.updaters.forEach((x) => {
        x.update(this.sim!)
      })
      this.explosions?.update(this, events.explosions)
      if (events.explosions.length !== 0) {
        this.sound.play("explosion", { volume: 1.0 })
      }
      this.#updateCamera(false)
    }
  }
}
