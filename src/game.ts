// The scene that runs the main game, including all the display logic

import * as Phaser from "phaser"
import * as Physics from "./physics"

const S = {
  fov: 65,
}

export default class Game extends Phaser.Scene {
  state: {
    physics: Physics.Sim
    ship: Phaser.GameObjects.Container
    turretGuns: Phaser.GameObjects.Line[]
    burners: Phaser.GameObjects.Particles.ParticleEmitter[]
    controls: Phaser.Input.Keyboard.Key[]
  } | null = null

  constructor() {
    super({ key: "game" })
  }

  preload(): void {
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
    this.load.json("level", "level.json")
  }

  createTerrain(physics: Physics.Sim): Phaser.GameObjects.Line[] {
    // Turrets
    const turretGuns: Phaser.GameObjects.Line[] = []
    physics.turrets.forEach((x, i) => {
      this.add.circle(x[0], x[1], 1, 0xffffffff)
      turretGuns.push(
        this.add
          .line(x[0], x[1], 0, 0, 0, -1.75, 0xffffffff)
          .setRotation(physics.turretsAngle[i])
          .setLineWidth(0.2)
          .setOrigin(0, 0),
      )
    })
    // Ground
    const xy: number[][] = []
    physics.terrain.forEach((r: number, i: number) => {
      const theta = (2 * Math.PI * i) / (physics.terrain.length - 1)
      xy.push([r * Math.sin(theta), -r * Math.cos(theta)])
    })
    this.add.polygon(0, 0, xy, 0xff888888).setOrigin(0, 0)
    return turretGuns
  }

  create(): void {
    const physics = new Physics.Sim(this.cache.json.get("level"))
    // Ship
    const ship = this.add.container(physics.ship[0], physics.ship[1], [
      this.add
        .image(0, 0, "ship")
        .setOrigin(0.5, 0.5)
        .setScale(Physics.S.shipSize / 256)
        .setFlipY(true),
    ])
    const offs = [1, 0, -1]
    const burners = offs.map((off) => {
      const angle =
        off === 0 ? { min: -180, max: 0 } : { min: -90 + 10 * off, max: -90 }
      const burner = this.add.particles(0.6 * off, -1.4, "smoke", {
        lifespan: 400,
        scale: { start: 0.02, end: 0.0, ease: "sine.in" },
        angle,
        speed: 15,
        blendMode: "ADD",
        frequency: 15,
      })
      ship.add(burner)
      return burner
    })
    // Ground
    const turretGuns = this.createTerrain(physics)
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
    const controls = keys.map((key) => this.input.keyboard!.addKey(key))
    // State
    this.state = {
      physics,
      ship,
      turretGuns,
      burners,
      controls,
    }
  }

  update(_time: number, delta: number): void {
    if (this.state !== null && !this.state.physics.shipExplode) {
      const s = this.state
      s.physics.control[0] = +s.controls[0].isDown
      s.physics.control[1] = +s.controls[1].isDown
      s.physics.control[2] = +s.controls[2].isDown
      s.physics.update(delta / 1000)

      if (s.physics.shipExplode) {
        s.ship.destroy()
        this.add.particles(s.physics.ship[0], s.physics.ship[1], "smoke", {
          blendMode: "ADD",
          lifespan: 500,
          speed: 11,
          frequency: 1,
          duration: 350,
          scale: { start: 0.01, end: 0.06, ease: "cube.out" },
          alpha: { start: 0.4, end: 0, ease: "cube.out" },
        })
      } else {
        s.ship.setPosition(s.physics.ship[0], s.physics.ship[1])
        s.ship.setRotation(s.physics.shipO)
        s.burners[0].emitting = s.controls[0].isDown
        s.burners[1].emitting = s.controls[1].isDown
        s.burners[2].emitting = s.controls[2].isDown
        s.physics.turretsAngle.forEach((angle, i) => {
          s.turretGuns[i].setRotation(angle)
        })
      }

      const camera = this.cameras.main
      const rotation =
        Math.atan2(s.physics.ship[0], s.physics.ship[1]) + Math.PI
      camera.setRotation(rotation)
      camera.setFollowOffset(-10 * Math.sin(rotation), -10 * Math.cos(rotation))
    }
  }
}
