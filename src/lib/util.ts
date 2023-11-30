export function setLayoutFn(scene: Phaser.Scene, fn: () => void): void {
  fn()
  scene.scale.on("resize", fn)
  scene.events.on("shutdown", () => {
    scene.scale.removeListener("resize", fn)
  })
}
