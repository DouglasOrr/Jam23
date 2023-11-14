import * as Phaser from "phaser"

const S = {
  // Physics
  G: 10,
  thrust: 30,
  velocityDamping: 0.07,
  rotationRate: 5,
  rotationDamping: 1.5,
  lift: 0.1,
  // View
  fov: 65,
}

interface LevelData {
  spacing: number
  height: number[]
}

class Physics {
  terrain: number[]
  ship: [number, number]
  shipV: [number, number] = [0, 0]
  shipO: number = Math.PI
  shipOV: number = 0
  control: [number, number, number] = [0, 0, 0]

  constructor(level: LevelData) {
    const r0 = (level.height.length * level.spacing) / (2 * Math.PI)
    this.terrain = level.height.map((h: number) => r0 + h)
    this.ship = [0, -this.terrain[0] - 10]
  }

  update(dt: number): void {
    // Orientation
    this.shipOV +=
      dt *
      (S.rotationRate * (this.control[0] - this.control[2]) -
        S.rotationDamping * this.shipOV)
    this.shipO += dt * this.shipOV
    // Velocity
    const r = Math.sqrt(this.ship[0] ** 2 + this.ship[1] ** 2)
    const sinA = this.ship[0] / r
    const cosA = this.ship[1] / r
    const sinO = -Math.sin(this.shipO)
    const cosO = Math.cos(this.shipO)
    const thrust =
      (S.thrust * (this.control[0] - 2 * this.control[1] + this.control[2])) / 2
    const up =
      -S.G + S.lift * Math.max(this.shipV[0] * sinO + this.shipV[1] * cosO, 0)
    const speed = Math.sqrt(this.shipV[0] ** 2 + this.shipV[1] ** 2)
    const drag = S.velocityDamping * speed
    this.shipV[0] += dt * (up * sinA + thrust * sinO - drag * this.shipV[0])
    this.shipV[1] += dt * (up * cosA + thrust * cosO - drag * this.shipV[1])
    // Position
    this.ship[0] += dt * this.shipV[0]
    this.ship[1] += dt * this.shipV[1]
  }
}

class Main extends Phaser.Scene {
  state: {
    physics: Physics
    ship: Phaser.GameObjects.Container
    burners: Phaser.GameObjects.Particles.ParticleEmitter[]
    controls: Phaser.Input.Keyboard.Key[]
  } | null = null

  constructor() {
    super({ key: "main" })
  }

  preload(): void {
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
    this.load.json("level", "level.json")
  }

  createTerrain(physics: Physics): void {
    const xy: number[][] = []
    physics.terrain.forEach((r: number, i: number) => {
      const theta = (2 * Math.PI * i) / physics.terrain.length
      xy.push([r * Math.sin(theta), -r * Math.cos(theta)])
    })
    this.add.polygon(0, 0, xy, 0xff888888).setOrigin(0, 0)
  }

  create(): void {
    const physics = new Physics(this.cache.json.get("level"))
    // Ship
    const ship = this.add.container(physics.ship[0], physics.ship[1], [
      this.add
        .image(0, 0, "ship")
        .setOrigin(0.5, 0.5)
        .setScale(1 / 128)
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
    this.createTerrain(physics)
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
      burners,
      controls,
    }
  }

  update(_time: number, delta: number): void {
    if (this.state !== null) {
      const s = this.state
      s.physics.control[0] = +s.controls[0].isDown
      s.physics.control[1] = +s.controls[1].isDown
      s.physics.control[2] = +s.controls[2].isDown
      s.physics.update(delta / 1000)
      s.ship.setPosition(s.physics.ship[0], s.physics.ship[1])
      s.ship.setRotation(s.physics.shipO)
      s.burners[0].emitting = s.controls[0].isDown
      s.burners[1].emitting = s.controls[1].isDown
      s.burners[2].emitting = s.controls[2].isDown
      const camera = this.cameras.main
      const rotation =
        Math.atan2(s.physics.ship[0], s.physics.ship[1]) + Math.PI
      camera.setRotation(rotation)
      camera.setFollowOffset(-10 * Math.sin(rotation), -10 * Math.cos(rotation))
    }
  }
}

class UI extends Phaser.Scene {
  constructor() {
    super({ key: "ui" })
  }

  create(): void {
    this.scene.launch("main")
    this.input.keyboard!.on("keydown-SPACE", () => {
      const mainScene = this.scene.get("main").scene
      if (mainScene.isPaused()) {
        mainScene.resume()
      } else {
        mainScene.pause()
      }
    })
  }
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  width: 600,
  height: 600,
  scene: [UI, Main],
})
