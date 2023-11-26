import * as Physics from "./physics"

// An agent that follows simple heuristics and rules to follow a target ship
export default class ScriptAgent {
  index: number
  targetIndex: number
  followOffset: Physics.Vec2

  constructor(index: number, targetIndex: number, followOffset: Physics.Vec2) {
    this.index = index
    this.targetIndex = targetIndex
    this.followOffset = followOffset
  }

  update(sim: Physics.Sim): void {
    // Target
    const shipPosition = sim.ships.position[this.targetIndex]
    const bearing = Math.atan2(-shipPosition[0], shipPosition[1])
    const cosB = Math.cos(bearing)
    const sinB = Math.sin(bearing)
    const targetx =
      shipPosition[0] -
      this.followOffset[0] * cosB -
      this.followOffset[1] * sinB
    const targety =
      shipPosition[1] -
      this.followOffset[0] * sinB +
      this.followOffset[1] * cosB
    const targetVelocity = sim.ships.velocity[this.targetIndex]

    // State
    const position = sim.ships.position[this.index]
    const velocity = sim.ships.velocity[this.index]
    const angle = sim.ships.angle[this.index]

    // Compute ideal velocity
    const rx = targetx - position[0]
    const ry = targety - position[1]
    const distance = Math.sqrt(rx ** 2 + ry ** 2)
    const idealSpeed = Math.min(3 * distance, 30)
    const ivelocityx = (idealSpeed * rx) / distance + targetVelocity[0]
    const ivelocityy = (idealSpeed * ry) / distance + targetVelocity[1]

    // Compute ideal acceleration direction
    const dvelocityx = ivelocityx - velocity[0]
    const dvelocityy = ivelocityy - velocity[1]
    const dspeed = Math.sqrt(dvelocityx ** 2 + dvelocityy ** 2)
    const idelta = Physics.angleBetween(
      angle,
      Math.atan2(-dvelocityx, dvelocityy),
    )

    // Accelerate
    const control = sim.ships.control[this.index]
    control.dropBomb = sim.ships.control[this.targetIndex].dropBomb
    if (dspeed < 4) {
      control.left = control.right = control.retro = false
    } else if (Math.abs(idelta) < 0.2) {
      control.left = control.right = true
      control.retro = false
    } else if (Math.abs(idelta) < 0.4) {
      control.retro = false
      control.left = idelta > 0
      control.right = idelta < 0
    } else {
      control.retro = true
      control.left = idelta > 0
      control.right = idelta < 0
    }
  }
}
