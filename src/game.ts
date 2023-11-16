// The scene that runs the main game, including all the display logic

import * as Phaser from "phaser"
import * as Physics from "./physics"

const S = {
  fov: 65,
  bulletRadius: 0.2,
}

interface SimUpdate {
  update: (sim: Physics.Sim) => void
}

class Ship extends Phaser.GameObjects.Container implements SimUpdate {
  index: number
  burners: Phaser.GameObjects.Particles.ParticleEmitter[]

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    super(scene)
    this.index = index
    this.add(
      this.scene.add
        .image(0, 0, "ship")
        .setOrigin(0.5, 0.5)
        .setScale(Physics.S.shipSize / 256)
        .setFlipY(true),
    )
    const offs = [1, 0, -1]
    this.burners = offs.map((off) => {
      const angle =
        off === 0 ? { min: -180, max: 0 } : { min: -90 + 10 * off, max: -90 }
      return this.scene.add.particles(0.6 * off, -1.4, "smoke", {
        lifespan: 400,
        scale: { start: 0.02, end: 0.0, ease: "sine.in" },
        angle,
        speed: 15,
        blendMode: "ADD",
        frequency: 15,
      })
    })
    this.add(this.burners)
    this.update(sim)
  }

  update(sim: Physics.Sim): void {
    this.setVisible(sim.ships.alive[this.index])
    const position = sim.ships.position[this.index]
    this.setPosition(position[0], position[1])
    this.setRotation(sim.ships.angle[this.index])
    const control = sim.ships.control[this.index]
    this.burners[0].emitting = control[0]
    this.burners[1].emitting = control[1]
    this.burners[2].emitting = control[2]
  }
}

class Turret implements SimUpdate {
  index: number
  gun: Phaser.GameObjects.Line

  constructor(scene: Phaser.Scene, sim: Physics.Sim, index: number) {
    this.index = index
    const position = sim.turrets.position[this.index]
    scene.add.circle(position[0], position[1], 1, 0xffffffff)
    this.gun = scene.add
      .line(position[0], position[1], 0, 0, 0, -1.75, 0xffffffff)
      .setRotation(sim.turrets.angle[this.index])
      .setLineWidth(0.2)
      .setOrigin(0, 0)
  }

  update(sim: Physics.Sim): void {
    this.gun.setRotation(sim.turrets.angle[this.index])
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

export default class Game extends Phaser.Scene {
  sim?: Physics.Sim
  updaters: SimUpdate[] = []
  controls: Phaser.Input.Keyboard.Key[] = []

  constructor() {
    super({ key: "game" })
  }

  preload(): void {
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
    this.load.json("level", "level.json")
  }

  create(): void {
    this.sim = new Physics.Sim(this.cache.json.get("level"))

    // Ship
    this.updaters = []
    const ship = this.add.existing(new Ship(this, this.sim, 0))
    this.updaters.push(ship)

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

    // Camera
    const camera = this.cameras.main
    camera.setZoom(Math.min(camera.width / S.fov, camera.height / S.fov))
    camera.setScroll(-camera.width / 2, -camera.height / 2)
    camera.startFollow(ship, false, 0.05, 0.05)

    // Control
    const keys = [
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]
    this.controls = keys.map((key) => this.input.keyboard!.addKey(key))
  }

  update(_time: number, delta: number): void {
    if (this.sim !== undefined) {
      const shipControl = this.sim.ships.control[0]
      shipControl[0] = this.controls[0].isDown
      shipControl[1] = this.controls[1].isDown
      shipControl[2] = this.controls[2].isDown

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
