import * as Phaser from "phaser"

class Main extends Phaser.Scene {
  create(): void {
    this.add.text(100, 100, "Hello Game Off '23", { color: "#ffffffff" })
  }
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  width: 800,
  height: 800,
  scene: Main,
})
