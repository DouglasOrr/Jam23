// The scene that runs the main game, including all the display logic

import * as Phaser from "phaser"
import * as Physics from "./physics"

const S = {
  fov: 65,
  bulletRadius: 0.2,
  friendlyAlpha: 0.6,
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
      alpha: this.index === 0 ? 1 : S.friendlyAlpha,
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
        -Physics.S.turretLength,
        0xffffffff,
      )
      .setRotation(sim.turrets.angle[this.index])
      .setLineWidth(0.2)
      .setOrigin(0, 0)
  }

  update(sim: Physics.Sim): void {
    this.body.setVisible(sim.turrets.alive[this.index])
    this.gun
      .setRotation(sim.turrets.angle[this.index])
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
        .setPosition(position[0], position[1])
        .setRotation(Math.atan2(velocity[0], -velocity[1]))
    }
  }
}

class KeyboardControl implements SimUpdate {
  index: number
  controls: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    retro: Phaser.Input.Keyboard.Key
    dropBomb: Phaser.Input.Keyboard.Key
  }

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, index: number) {
    this.index = index
    this.controls = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      retro: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      dropBomb: keyboard.addKey("x"),
    }
  }

  update(sim: Physics.Sim): void {
    const shipControl = sim.ships.control[this.index]
    shipControl.left = this.controls.left.isDown
    shipControl.right = this.controls.right.isDown
    shipControl.retro = this.controls.retro.isDown
    shipControl.dropBomb = this.controls.dropBomb.isDown
  }
}

export default class Game extends Phaser.Scene {
  sim?: Physics.Sim
  controllers: SimUpdate[] = []
  updaters: SimUpdate[] = []
  controls: Phaser.Input.Keyboard.Key[] = []
  controlBomb?: Phaser.Input.Keyboard.Key

  constructor() {
    super({ key: "game" })
  }

  preload(): void {
    this.load.json("level", "level.json")
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
    this.load.image("bomb", "bomb.png")
  }

  create(): void {
    this.sim = new Physics.Sim(this.cache.json.get("level"))
    this.controllers = []
    this.updaters = []

    // Ship
    const ships = this.sim.ships.position.map((_, i) =>
      this.add.existing(new Ship(this, this.sim!, i)),
    )
    this.updaters.push(...ships)

    // Level
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
    this.sim.ships.position.forEach((_, i) => {
      this.controllers.push(new KeyboardControl(this.input.keyboard!, i))
    })

    // Camera
    const camera = this.cameras.main
    camera.setZoom(Math.min(camera.width / S.fov, camera.height / S.fov))
    camera.setScroll(-camera.width / 2, -camera.height / 2)
    camera.startFollow(ships[0], false, 0.05, 0.05)
  }

  update(_time: number, delta: number): void {
    if (this.sim !== undefined) {
      this.controllers.forEach((x) => {
        x.update(this.sim!)
      })
      const events = this.sim.update(delta / 1000)
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
      const camera = this.cameras.main
      const shipPosition = this.sim.ships.position[0]
      const rotation = Math.atan2(shipPosition[0], shipPosition[1]) + Math.PI
      camera.setRotation(rotation)
      camera.setFollowOffset(-10 * Math.sin(rotation), -10 * Math.cos(rotation))
    }
  }
}
