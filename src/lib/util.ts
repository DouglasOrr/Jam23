import * as Phaser from "phaser"

export function setLayoutFn(scene: Phaser.Scene, fn: () => void): void {
  fn()
  scene.scale.on("resize", fn)
  scene.events.once("shutdown", () => {
    scene.scale.removeListener("resize", fn)
  })
}

export function downloadJSON(
  data: Record<string, unknown>,
  name: string,
): void {
  const a = document.createElement("a")
  a.href =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data))
  a.download = name
  a.click()
  a.remove()
}
