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

function distanceSq(a: Vec2, b: Vec2): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
}

export function rotateTowards(
  angle: number,
  targetAngle: number,
  maxDelta: number,
): number {
  // Take care of wrapping around the PI/-PI discontinuity
  let da = targetAngle - angle
  if (Math.abs(da) > Math.PI) {
    da -= Math.sign(da) * 2 * Math.PI
  }
  let newAngle = angle + Math.sign(da) * Math.min(Math.abs(da), maxDelta)
  if (Math.abs(newAngle) > Math.PI) {
    newAngle -= Math.sign(newAngle) * 2 * Math.PI
  }
  return newAngle
}

// Main logic

export const S = {
  // Ship
  G: 10,
  thrust: 40,
  velocityDamping: 0.08,
  rotationRate: 5,
  rotationDamping: 1.5,
  lift: 0.1,
  shipSize: 2,
  shipReloadTime: 5,
  // Bomb
  maxBombs: 50,
  bombTimeToLive: 10,
  bombSize: 1.5,
  bombBlastRadius: 5,
  // Turret
  turretRotationRate: 0.5,
  turretReloadTime: 0.75,
  turretLength: 1.75,
  // Bullet
  bulletSpeed: 20,
  bulletRange: 80,
  maxBullets: 100,
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

// Find a dead object, or the oldest object
function freeIndex(timeToLive: number[]): number {
  let lowestTimeToLiveIndex = 0
  let lowestTimeToLive = timeToLive[0]
  for (let i = 0; i < timeToLive.length; ++i) {
    if (timeToLive[i] <= 0) {
      return i
    }
    if (timeToLive[i] < lowestTimeToLive) {
      lowestTimeToLive = timeToLive[i]
      lowestTimeToLiveIndex = i
    }
  }
  return lowestTimeToLiveIndex
}

export class Bullets {
  position: Vec2[] = []
  velocity: Vec2[] = []
  timeToLive: number[] = []

  constructor() {
    for (let i = 0; i < S.maxBullets; ++i) {
      this.position.push([0, 0])
      this.velocity.push([0, 0])
      this.timeToLive.push(0)
    }
  }

  fire(position: Vec2, angle: number): void {
    const index = freeIndex(this.timeToLive)
    this.position[index][0] = position[0]
    this.position[index][1] = position[1]
    this.velocity[index][0] = S.bulletSpeed * Math.sin(angle)
    this.velocity[index][1] = S.bulletSpeed * -Math.cos(angle)
    this.timeToLive[index] = S.bulletRange / S.bulletSpeed
  }

  update(sim: Sim, dt: number): void {
    for (let i = 0; i < S.maxBullets; ++i) {
      if (0 < this.timeToLive[i]) {
        const position = this.position[i]
        const velocity = this.velocity[i]
        position[0] += dt * velocity[0]
        position[1] += dt * velocity[1]
        this.timeToLive[i] -= dt

        // Terrain collision
        const height2 = position[0] ** 2 + position[1] ** 2
        if (height2 < sim.planet.getHeight(position) ** 2) {
          this.timeToLive[i] = 0
        }
      }
    }
  }
}

export class Bombs {
  position: Vec2[] = []
  velocity: Vec2[] = []
  timeToLive: number[] = []

  constructor() {
    for (let i = 0; i < S.maxBombs; ++i) {
      this.position.push([0, 0])
      this.velocity.push([0, 0])
      this.timeToLive.push(0)
    }
  }

  fire(position: Vec2, velocity: Vec2): void {
    const index = freeIndex(this.timeToLive)
    this.position[index][0] = position[0]
    this.position[index][1] = position[1]
    this.velocity[index][0] = velocity[0]
    this.velocity[index][1] = velocity[1]
    this.timeToLive[index] = S.bombTimeToLive
  }

  update(sim: Sim, dt: number, events: Events): void {
    for (let i = 0; i < S.maxBombs; ++i) {
      if (0 < this.timeToLive[i]) {
        const position = this.position[i]
        const height = Math.sqrt(position[0] ** 2 + position[1] ** 2)
        const velocity = this.velocity[i]
        velocity[0] -= (dt * S.G * position[0]) / height
        velocity[1] -= (dt * S.G * position[1]) / height
        position[0] += dt * velocity[0]
        position[1] += dt * velocity[1]
        this.timeToLive[i] -= dt

        // Terrain collision
        if (height < sim.planet.getHeight(position) + S.bombSize / 2) {
          this.timeToLive[i] = 0
          events.explosions.push(position)
          for (let j = 0; j < sim.turrets.position.length; ++j) {
            const turretPosition = sim.turrets.position[j]
            if (
              sim.turrets.alive[j] &&
              distanceSq(position, turretPosition) < S.bombBlastRadius ** 2
            ) {
              sim.turrets.alive[j] = false
              events.explosions.push(turretPosition)
            }
          }
        }
      }
    }
  }
}

export class Turrets {
  position: Vec2[] = []
  angle: number[] = []
  reload: number[] = []
  alive: boolean[] = []

  constructor(surfacePosition: Vec2[], planet: Planet) {
    surfacePosition.forEach(([d, h]) => {
      const angle = d / planet.radius
      this.position.push([
        (planet.radius + h) * Math.sin(angle),
        -(planet.radius + h) * Math.cos(angle),
      ])
      this.angle.push(angle)
      this.reload.push(S.turretReloadTime)
      this.alive.push(true)
    })
  }

  update(sim: Sim, dt: number): void {
    this.position.forEach((position, i) => {
      if (this.alive[i]) {
        // Aim
        const shipPosition = sim.ships.position[0] // TODO: target selection
        this.angle[i] = rotateTowards(
          this.angle[i],
          Math.atan2(
            shipPosition[0] - position[0],
            -(shipPosition[1] - position[1]),
          ),
          dt * S.turretRotationRate,
        )

        // Fire
        this.reload[i] -= dt
        if (this.reload[i] <= 0) {
          const angle = this.angle[i]
          sim.bullets.fire(
            [
              position[0] + S.turretLength * Math.sin(angle),
              position[1] - S.turretLength * Math.cos(angle),
            ],
            angle,
          )
          this.reload[i] += S.turretReloadTime
        }
      }
    })
  }
}

export class Ships {
  position: Vec2[] = []
  velocity: Vec2[] = []
  angle: number[] = []
  angularVelocity: number[] = []
  reload: number[] = []
  alive: boolean[] = []
  control: Array<[boolean, boolean, boolean]> = []
  controlDropBomb: boolean[] = []

  add(position: Vec2): void {
    this.position.push(position)
    this.velocity.push([0, 0])
    this.angle.push(Math.atan2(-position[0], position[1]))
    this.angularVelocity.push(0)
    this.reload.push(0)
    this.alive.push(true)
    this.control.push([false, false, false])
    this.controlDropBomb.push(false)
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

        // Drop bomb
        this.reload[i] -= dt
        if (this.controlDropBomb[i] && this.reload[i] < 0) {
          sim.bombs.fire(this.position[i], this.velocity[i])
          this.reload[i] = S.shipReloadTime
        }
      }
    }
  }
}

export class Sim {
  planet: Planet
  turrets: Turrets
  bullets: Bullets = new Bullets()
  bombs: Bombs = new Bombs()
  ships: Ships = new Ships()

  constructor(level: LevelData) {
    this.planet = new Planet(level)
    this.turrets = new Turrets(level.turrets, this.planet)
    this.ships.add([0, -this.planet.height[0] - 10])
  }

  #detectCollisions(events: Events): void {
    // Exhaustive search, for now
    for (let shipI = 0; shipI < this.ships.position.length; ++shipI) {
      if (this.ships.alive[shipI]) {
        const ship = this.ships.position[shipI]
        for (
          let bulletI = 0;
          bulletI < this.bullets.position.length;
          ++bulletI
        ) {
          if (0 < this.bullets.timeToLive[bulletI]) {
            const bullet = this.bullets.position[bulletI]
            const distanceSq =
              (ship[0] - bullet[0]) ** 2 + (ship[1] - bullet[1]) ** 2
            if (distanceSq < S.shipSize ** 2) {
              this.ships.alive[shipI] = false
              this.bullets.timeToLive[bulletI] = 0
              events.explosions.push(ship)
            }
          }
        }
      }
    }
  }

  update(dt: number): Events {
    const events: Events = { explosions: [] }
    this.ships.update(this, dt, events)
    this.turrets.update(this, dt)
    this.bullets.update(this, dt)
    this.bombs.update(this, dt, events)
    this.#detectCollisions(events)
    return events
  }
}
