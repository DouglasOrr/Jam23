// Core physics to simulate the complete game world

export const S = {
  // Ship
  G: 10,
  thrust: 30,
  velocityDamping: 0.07,
  rotationRate: 5,
  rotationDamping: 1.5,
  lift: 0.1,
  shipSize: 2,
  // Turret
  turretRotationRate: 0.5,
}

export interface LevelData {
  spacing: number
  height: number[]
  turrets: Array<[number, number]>
}

export class Sim {
  terrain: number[] // height (around the circle)
  turrets: Array<[number, number]>
  turretsAngle: number[]
  ship: [number, number]
  shipV: [number, number] = [0, 0]
  shipO: number = Math.PI
  shipOV: number = 0
  shipExplode: boolean = false
  control: [number, number, number] = [0, 0, 0]

  constructor(level: LevelData) {
    const r0 = (level.height.length * level.spacing) / (2 * Math.PI)
    this.terrain = level.height.map((h: number) => r0 + h)
    this.terrain.push(this.terrain[0]) // wrap-around (easier hit detection)
    this.ship = [0, -this.terrain[0] - 10]
    this.turrets = []
    this.turretsAngle = []
    level.turrets.forEach(([d, h]) => {
      const angle = (2 * Math.PI * d) / (level.height.length * level.spacing)
      this.turrets.push([
        (r0 + h) * Math.sin(angle),
        -(r0 + h) * Math.cos(angle),
      ])
      this.turretsAngle.push(angle)
    })
  }

  getTerrainHeight(position: [number, number]): number {
    let offset = Math.atan2(position[0], -position[1]) / (2 * Math.PI)
    offset = (this.terrain.length - 1) * (offset + +(offset < 0))
    const i0 = Math.floor(offset)
    const i1 = i0 + 1
    return (i1 - offset) * this.terrain[i0] + (offset - i0) * this.terrain[i1]
  }

  updateShip(dt: number): void {
    // State
    const r = Math.sqrt(this.ship[0] ** 2 + this.ship[1] ** 2)
    const sinA = this.ship[0] / r
    const cosA = this.ship[1] / r
    if (r < this.getTerrainHeight(this.ship) + S.shipSize / 2) {
      this.shipExplode = true
    }
    if (this.shipExplode) {
      return
    }
    // Orientation
    this.shipOV +=
      dt *
      (S.rotationRate * (this.control[0] - this.control[2]) -
        S.rotationDamping * this.shipOV)
    this.shipO += dt * this.shipOV
    // Velocity
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

  updateTurrets(dt: number): void {
    this.turrets.forEach((turret, i) => {
      const targetAngle = Math.atan2(
        this.ship[0] - turret[0],
        -(this.ship[1] - turret[1]),
      )
      const da = targetAngle - this.turretsAngle[i]
      this.turretsAngle[i] +=
        Math.min(Math.abs(da), dt * S.turretRotationRate) * Math.sign(da)
    })
  }

  update(dt: number): void {
    this.updateShip(dt)
    this.updateTurrets(dt)
  }
}
