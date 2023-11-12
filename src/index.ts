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
  ship: [number, number] = [0, 0]
  shipV: [number, number] = [0, 0]
  shipO: number = Math.PI
  shipOV: number = 0

  update(control: [number, number, number], dt: number): void {
    // Orientation
    this.shipOV +=
      dt *
      (S.rotationRate * (control[0] - control[2]) -
        S.rotationDamping * this.shipOV)
    this.shipO += dt * this.shipOV
    // Velocity
    const cosO = Math.cos(this.shipO)
    const sinO = -Math.sin(this.shipO)
    const dotp = this.shipV[0] * sinO + this.shipV[1] * cosO
    const thrust = (S.thrust * (control[0] - 2 * control[1] + control[2])) / 2
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
    ship: Phaser.GameObjects.Shape
    thrustLeft: Phaser.Input.Keyboard.Key
    thrustRight: Phaser.Input.Keyboard.Key
    thrustBack: Phaser.Input.Keyboard.Key
  } | null = null

  create(): void {
    // Ship
    const ship = this.add
      .triangle(0, 0, -1, 0, 0, 2, 1, 0, 0xffffffff)
      .setOrigin(0, 1)
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
    const thrustLeft = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.LEFT,
    )
    const thrustRight = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    )
    const thrustBack = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    )
    // State
    this.state = {
      game: new Game(),
      ship,
      thrustLeft,
      thrustRight,
      thrustBack,
    }
  }

  update(time: number, delta: number): void {
    if (this.state !== null) {
      const s = this.state
      s.game.update(
        [+s.thrustLeft.isDown, +s.thrustBack.isDown, +s.thrustRight.isDown],
        delta / 1000,
      )
      s.ship.setPosition(s.game.ship[0], s.game.ship[1])
      s.ship.setRotation(s.game.shipO)
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
