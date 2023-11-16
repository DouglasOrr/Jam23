// Core physics to simulate the complete game world

// Basic types

export type Vec2 = [number, number]

export interface LevelData {
  spacing: number
  height: number[]
  turrets: Vec2[]
}

export interface Events {
  explosions: Vec2[]
}

// Main logic

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

export class Planet {
  radius: number
  height: number[]

  constructor(level: LevelData) {
    this.radius = (level.height.length * level.spacing) / (2 * Math.PI)
    this.height = level.height.map((h: number) => this.radius + h)
    this.height.push(this.height[0]) // wrap-around (easier hit detection)
  }

  getHeight(position: [number, number]): number {
    let offset = Math.atan2(position[0], -position[1]) / (2 * Math.PI)
    offset = (this.height.length - 1) * (offset + +(offset < 0))
    const i0 = Math.floor(offset)
    const i1 = i0 + 1
    return (i1 - offset) * this.height[i0] + (offset - i0) * this.height[i1]
  }
}

export class Turrets {
  position: Vec2[] = []
  angle: number[] = []

  constructor(surfacePosition: Vec2[], planet: Planet) {
    surfacePosition.forEach(([d, h]) => {
      const angle = d / planet.radius
      this.position.push([
        (planet.radius + h) * Math.sin(angle),
        -(planet.radius + h) * Math.cos(angle),
      ])
      this.angle.push(angle)
    })
  }

  update(sim: Sim, dt: number): void {
    this.position.forEach((position, i) => {
      const shipPosition = sim.ships.position[0] // TODO: target selection
      const targetAngle = Math.atan2(
        shipPosition[0] - position[0],
        -(shipPosition[1] - position[1]),
      )
      const da = targetAngle - this.angle[i]
      this.angle[i] +=
        Math.min(Math.abs(da), dt * S.turretRotationRate) * Math.sign(da)
    })
  }
}

export class Ships {
  position: Vec2[] = []
  velocity: Vec2[] = []
  angle: number[] = []
  angularVelocity: number[] = []
  alive: boolean[] = []
  control: Array<[boolean, boolean, boolean]> = []

  add(position: Vec2): void {
    this.position.push(position)
    this.velocity.push([0, 0])
    this.angle.push(Math.atan2(-position[0], position[1]))
    this.angularVelocity.push(0)
    this.alive.push(true)
    this.control.push([false, false, false])
  }

  update(sim: Sim, dt: number, events: Events): void {
    for (let i = 0; i < this.position.length; ++i) {
      if (this.alive[i]) {
        // State
        const position = this.position[i]
        const velocity = this.velocity[i]
        const control = this.control[i]
        const r = Math.sqrt(position[0] ** 2 + position[1] ** 2)
        const sinBearing = position[0] / r
        const cosBearing = position[1] / r

        // Collision
        if (r < sim.planet.getHeight(position) + S.shipSize / 2) {
          this.alive[i] = false
          events.explosions.push(position)
          continue
        }

        // Orientation
        let angle = this.angle[i]
        let angularVelocity = this.angularVelocity[i]
        angularVelocity +=
          dt *
          (S.rotationRate * (+control[0] - +control[2]) -
            S.rotationDamping * angularVelocity)
        angle += dt * angularVelocity
        this.angularVelocity[i] = angularVelocity
        this.angle[i] = angle

        // Velocity
        const sinA = -Math.sin(angle)
        const cosA = Math.cos(angle)
        const thrust =
          (S.thrust * (+control[0] - 2 * +control[1] + +control[2])) / 2
        const up =
          -S.G + S.lift * Math.max(velocity[0] * sinA + velocity[1] * cosA, 0)
        const speed = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2)
        const drag = S.velocityDamping * speed
        velocity[0] +=
          dt * (up * sinBearing + thrust * sinA - drag * velocity[0])
        velocity[1] +=
          dt * (up * cosBearing + thrust * cosA - drag * velocity[1])

        // Position
        position[0] += dt * velocity[0]
        position[1] += dt * velocity[1]
      }
    }
  }
}

export class Sim {
  planet: Planet
  turrets: Turrets
  ships: Ships = new Ships()

  constructor(level: LevelData) {
    this.planet = new Planet(level)
    this.turrets = new Turrets(level.turrets, this.planet)
    this.ships.add([0, -this.planet.height[0] - 10])
  }

  update(dt: number): Events {
    const events: Events = { explosions: [] }
    this.ships.update(this, dt, events)
    this.turrets.update(this, dt)
    return events
  }
}
