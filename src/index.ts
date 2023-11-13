import * as Phaser from "phaser"

const S = {
  G: 5,
  thrust: 20,
  velocityDamping: 0.1,
  rotationRate: 4,
  rotationDamping: 1,
  lift: 0.1,
}

class Game {
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
    game: Game
    ship: Phaser.GameObjects.Container
    burners: Phaser.GameObjects.Particles.ParticleEmitter[]
    controls: Phaser.Input.Keyboard.Key[]
  } | null = null

  preload(): void {
    this.load.image("ship", "ship.png")
    this.load.image("smoke", "smoke.png")
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
    this.add.rectangle(0, 20, 1000, 100, 0xff888888).setOrigin(0.5, 0)
    for (let x = -500; x <= 500; x += 10) {
      this.add
        .line(x, 20, 0, 0, 0, 100, 0xff444444)
        .setOrigin(0, 0)
        .setLineWidth(0.1)
    }
    // Camera
    const camera = this.cameras.main
    camera.setZoom(Math.min(camera.width / 60, camera.height / 60))
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
      game: new Game(),
      ship,
      burners,
      controls,
    }
  }

  update(time: number, delta: number): void {
    if (this.state !== null) {
      const s = this.state
      s.game.control[0] = +s.controls[0].isDown
      s.game.control[1] = +s.controls[1].isDown
      s.game.control[2] = +s.controls[2].isDown
      s.game.update(delta / 1000)
      s.ship.setPosition(s.game.ship[0], s.game.ship[1])
      s.ship.setRotation(s.game.shipO)
      s.burners[0].emitting = s.controls[0].isDown
      s.burners[1].emitting = s.controls[1].isDown
      s.burners[2].emitting = s.controls[2].isDown
    }
  }
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  width: 600,
  height: 600,
  scene: Main,
})
