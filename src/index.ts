import * as Phaser from "phaser"

const S = {
  // Physics
  G: 5,
  thrust: 20,
  velocityDamping: 0.1,
  rotationRate: 4,
  rotationDamping: 1,
  lift: 0.1,
  // View
  fov: 60,
}

class Physics {
  control: [number, number, number] = [0, 0, 0]
  ship: [number, number] = [0, 0]
  shipV: [number, number] = [0, 0]
  shipO: number = Math.PI
  shipOV: number = 0

  update(dt: number): void {
    // Orientation
    this.shipOV +=
      dt *
      (S.rotationRate * (this.control[0] - this.control[2]) -
        S.rotationDamping * this.shipOV)
    this.shipO += dt * this.shipOV
    // Velocity
    const cosO = Math.cos(this.shipO)
    const sinO = -Math.sin(this.shipO)
    const dotp = this.shipV[0] * sinO + this.shipV[1] * cosO
    const thrust =
      (S.thrust * (this.control[0] - 2 * this.control[1] + this.control[2])) / 2
    this.shipV[0] += dt * (thrust * sinO - S.velocityDamping * this.shipV[0])
    this.shipV[1] +=
      dt *
      (S.G +
        thrust * cosO -
        S.lift * Math.abs(sinO) * Math.max(dotp, 0) -
        S.velocityDamping * this.shipV[1])
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

  createTerrain(): void {
    const data = this.cache.json.get("level")
    const w = data.spacing
    const h0 = 1000
    const points: number[][] = []
    points.push([0, h0])
    data.height.forEach((h: number, i: number) => {
      points.push([i * w, -h])
    })
    points.push([(data.height.length - 1) * w, h0])
    this.add.polygon(0, 20, points, 0xff888888).setOrigin(0, 0)
  }

  create(): void {
    // Ship
    const ship = this.add.container(0, 0, [
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
    this.createTerrain()
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
      physics: new Physics(),
      ship,
      burners,
      controls,
    }
  }

  update(time: number, delta: number): void {
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
