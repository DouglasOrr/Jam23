// Core physics to simulate the complete game world

// Basic types

export type Vec2 = [number, number]

export interface PlanetData {
  spacing: number
  height: number[]
}

export interface TurretData {
  position: Vec2
  level: number
}

export interface LevelData extends PlanetData {
  turrets: TurretData[]
  factories: Vec2[]
  allies: number
}

export class Events {
  explosions: Vec2[] = []
  playerDeath: boolean = false
}

function distanceSq(a: Vec2, b: Vec2): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
}

// Difference between angles in the range [-PI, PI]
export function angleBetween(a: number, b: number): number {
  let diff = b - a
  if (Math.abs(diff) > Math.PI) {
    diff -= Math.sign(diff) * 2 * Math.PI
  }
  return diff
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
  dt: 1 / 100,
  // Ship
  G: 10,
  thrust: 40,
  velocityDamping: 0.08,
  rotationRate: 5,
  rotationDamping: 1.5,
  lift: 0.1,
  shipSize: 2,
  shipReloadTime: 5,
  maxAltitude: 100,
  startAltitude: 20,
  allySpacing: 5,
  respawnDelay: [2, 5],
  // Bomb
  maxBombs: 50,
  bombTimeToLive: 10,
  bombSize: 1.5,
  bombBlastRadius: 5,
  // Turret
  turretRotationRate: [0.5, 0.5, 1.0, 10.0],
  bulletSpeed: [15, 20, 20, 30],
  turretReloadTime: 0.75,
  turretLength: 1.75,
  bulletRange: 80,
  maxBullets: 100,
}

export class Planet {
  radius: number
  height: number[]

  constructor(data: PlanetData) {
    this.radius = (data.height.length * data.spacing) / (2 * Math.PI)
    this.height = data.height.map((h: number) => this.radius + h)
    this.height.push(this.height[0]) // wrap-around (easier hit detection)
  }

  getHeight(position: [number, number]): number {
    let offset = Math.atan2(position[0], -position[1]) / (2 * Math.PI)
    offset = (this.height.length - 1) * (offset + +(offset < 0))
    const i0 = Math.min(Math.floor(offset), this.height.length - 2)
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

  fire(position: Vec2, angle: number, speed: number): void {
    const index = freeIndex(this.timeToLive)
    this.position[index][0] = position[0]
    this.position[index][1] = position[1]
    this.velocity[index][0] = speed * -Math.sin(angle)
    this.velocity[index][1] = speed * Math.cos(angle)
    this.timeToLive[index] = S.bulletRange / speed
  }

  update(sim: Sim): void {
    for (let i = 0; i < S.maxBullets; ++i) {
      if (0 < this.timeToLive[i]) {
        const position = this.position[i]
        const velocity = this.velocity[i]
        position[0] += S.dt * velocity[0]
        position[1] += S.dt * velocity[1]
        this.timeToLive[i] -= S.dt

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
  owner: number[] = []

  constructor() {
    for (let i = 0; i < S.maxBombs; ++i) {
      this.position.push([0, 0])
      this.velocity.push([0, 0])
      this.timeToLive.push(0)
      this.owner.push(0)
    }
  }

  fire(position: Vec2, velocity: Vec2, owner: number): void {
    const index = freeIndex(this.timeToLive)
    this.position[index][0] = position[0]
    this.position[index][1] = position[1]
    this.velocity[index][0] = velocity[0]
    this.velocity[index][1] = velocity[1]
    this.timeToLive[index] = S.bombTimeToLive
    this.owner[index] = owner
  }

  #blowUpSurface(
    position: [number, number],
    objects: SurfaceObjects,
    events: Events,
  ): void {
    objects.position.forEach((objPosition, i) => {
      if (
        objects.alive[i] &&
        distanceSq(position, objPosition) < S.bombBlastRadius ** 2
      ) {
        objects.alive[i] = false
        events.explosions.push(objPosition)
      }
    })
  }

  update(sim: Sim, events: Events): void {
    for (let i = 0; i < S.maxBombs; ++i) {
      if (0 < this.timeToLive[i]) {
        const position = this.position[i]
        const height = Math.sqrt(position[0] ** 2 + position[1] ** 2)
        const velocity = this.velocity[i]
        velocity[0] -= (S.dt * S.G * position[0]) / height
        velocity[1] -= (S.dt * S.G * position[1]) / height
        position[0] += S.dt * velocity[0]
        position[1] += S.dt * velocity[1]
        this.timeToLive[i] -= S.dt

        // Terrain collision
        if (height < sim.planet.getHeight(position) + S.bombSize / 2) {
          this.timeToLive[i] = 0
          events.explosions.push(position)
          this.#blowUpSurface(position, sim.turrets, events)
          this.#blowUpSurface(position, sim.factories, events)
        }
      }
    }
  }
}

class SurfaceObjects {
  position: Vec2[] = []
  angle: number[] = []
  alive: boolean[] = []

  constructor(surfacePosition: Vec2[], planet: Planet) {
    surfacePosition.forEach(([d, h]) => {
      const angle = d / planet.radius - Math.PI
      this.position.push([
        -(planet.radius + h) * Math.sin(angle),
        (planet.radius + h) * Math.cos(angle),
      ])
      this.angle.push(angle)
      this.alive.push(true)
    })
  }
}

export class Factories extends SurfaceObjects {}

export class Turrets extends SurfaceObjects {
  level: number[] = []
  turretAngle: number[] = []
  reload: number[] = []
  level0rotateDirection: number[] = []

  constructor(data: TurretData[], planet: Planet) {
    super(
      data.map((d) => d.position),
      planet,
    )
    data.forEach((d, i) => {
      this.level.push(d.level)
      this.turretAngle.push(this.angle[i])
      this.reload.push(S.turretReloadTime)
      this.level0rotateDirection.push(1)
    })
  }

  #maybeFire(i: number, sim: Sim): void {
    this.reload[i] -= S.dt
    if (this.reload[i] <= 0) {
      const position = this.position[i]
      const turretAngle = this.turretAngle[i]
      sim.bullets.fire(
        [
          position[0] - S.turretLength * Math.sin(turretAngle),
          position[1] + S.turretLength * Math.cos(turretAngle),
        ],
        turretAngle,
        S.bulletSpeed[this.level[i]],
      )
      this.reload[i] += S.turretReloadTime
    }
  }

  update(sim: Sim): void {
    this.position.forEach((position, i) => {
      if (this.alive[i]) {
        const level = this.level[i]
        if (level === 0) {
          // Level 0 turrets just sweep back & forth
          if (
            Math.PI / 3 <
            Math.abs(angleBetween(this.turretAngle[i], this.angle[i]))
          ) {
            this.level0rotateDirection[i] *= -1
          }
          this.turretAngle[i] +=
            this.level0rotateDirection[i] * S.dt * S.turretRotationRate[level]
          this.#maybeFire(i, sim)
        } else {
          // Level 1-2 turrets aim at a nearby ship
          // First, select a target
          let targetI: number | undefined
          let targetCost: number | undefined
          sim.ships.position.forEach((shipPosition, shipI) => {
            if (sim.ships.alive[shipI]) {
              const shipAngle = Math.atan2(
                -(shipPosition[0] - position[0]),
                shipPosition[1] - position[1],
              )
              const distance = Math.sqrt(distanceSq(position, shipPosition))
              // Use a heuristic to trade off radians against distance
              // Also, Level 3 turrets prefer to aim at the player
              const cost =
                distance +
                10 * Math.abs(angleBetween(this.turretAngle[i], shipAngle)) -
                100 * +(shipI === 0 && level >= 3)
              if (
                distance <= S.bulletRange &&
                (targetCost === undefined || cost < targetCost)
              ) {
                targetCost = cost
                targetI = shipI
              }
            }
          })
          if (targetI !== undefined) {
            const targetPosition = sim.ships.position[targetI]
            let targetAngle = Math.atan2(
              -(targetPosition[0] - position[0]),
              targetPosition[1] - position[1],
            )
            if (level >= 2) {
              const targetVelocity = sim.ships.velocity[targetI]
              const targetTangentVelocity =
                targetVelocity[0] * -Math.cos(targetAngle) +
                targetVelocity[1] * -Math.sin(targetAngle)
              targetAngle += targetTangentVelocity / S.bulletSpeed[level]
            }
            this.turretAngle[i] = rotateTowards(
              this.turretAngle[i],
              targetAngle,
              S.dt * S.turretRotationRate[level],
            )
            this.#maybeFire(i, sim)
          }
        }
      }
    })
  }
}

export class ShipControl {
  left: boolean = false
  right: boolean = false
  retro: boolean = false
  dropBomb: boolean = false
}

// Player ship (index 0) and allied ships (index >= 1)
// - note that these behave slightly differently
export class Ships {
  // player (0) absolute-cartesian, allies relative to player
  spawnPosition: Vec2[] = []
  position: Vec2[] = []
  velocity: Vec2[] = []
  angle: number[] = []
  angularVelocity: number[] = []
  reload: number[] = []
  alive: boolean[] = []
  respawn: number[] = []
  control: ShipControl[] = []

  getSpawnPosition(i: number): Vec2 {
    if (i === 0) {
      return this.spawnPosition[0].slice() as Vec2
    }
    const player = this.position[0]
    const spawn = this.spawnPosition[i]
    const bearing = Math.atan2(-player[0], player[1])
    const cosB = Math.cos(bearing)
    const sinB = Math.sin(bearing)
    const offsetX = spawn[0] * cosB - spawn[1] * sinB
    const offsetY = spawn[0] * sinB + spawn[1] * cosB
    return [player[0] + offsetX, player[1] + offsetY]
  }

  add(position: Vec2): void {
    this.spawnPosition.push(position.slice() as Vec2)
    position = this.getSpawnPosition(this.spawnPosition.length - 1)
    this.position.push(position)
    this.velocity.push([0, 0])
    this.angle.push(Math.atan2(-position[0], position[1]))
    this.angularVelocity.push(0)
    this.reload.push(0)
    this.alive.push(true)
    this.respawn.push(0)
    this.control.push(new ShipControl())
  }

  reset(i: number): void {
    const position = this.getSpawnPosition(i)
    this.position[i] = position.slice() as Vec2
    this.velocity[i] = [0, 0]
    this.angle[i] = Math.atan2(-position[0], position[1])
    this.angularVelocity[i] = 0
    this.reload[i] = 0
    this.alive[i] = true
    this.respawn[i] = 0
    this.control[i] = new ShipControl()
  }

  kill(i: number, events: Events): void {
    events.explosions.push(this.position[i])
    if (i === 0) {
      events.playerDeath = true
    }
    this.alive[i] = false
    this.respawn[i] = S.respawnDelay[+(1 <= i)]
  }

  update(sim: Sim, events: Events): void {
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
        const planetHeight = sim.planet.getHeight(position)
        if (
          r < planetHeight + S.shipSize / 2 ||
          planetHeight + S.maxAltitude < r
        ) {
          this.kill(i, events)
          continue
        }

        // Orientation
        let angle = this.angle[i]
        let angularVelocity = this.angularVelocity[i]
        angularVelocity +=
          S.dt *
          (S.rotationRate * (+control.left - +control.right) -
            S.rotationDamping * angularVelocity)
        angle += S.dt * angularVelocity
        angle += +(Math.abs(angle) > Math.PI) * -Math.sign(angle) * 2 * Math.PI
        this.angularVelocity[i] = angularVelocity
        this.angle[i] = angle

        // Velocity
        const sinA = -Math.sin(angle)
        const cosA = Math.cos(angle)
        const thrust =
          (S.thrust * (+control.left - +control.retro + +control.right)) / 2
        const up =
          -S.G + S.lift * Math.max(velocity[0] * sinA + velocity[1] * cosA, 0)
        const speed = Math.sqrt(velocity[0] ** 2 + velocity[1] ** 2)
        const drag = S.velocityDamping * speed
        velocity[0] +=
          S.dt * (up * sinBearing + thrust * sinA - drag * velocity[0])
        velocity[1] +=
          S.dt * (up * cosBearing + thrust * cosA - drag * velocity[1])

        // Position
        position[0] += S.dt * velocity[0]
        position[1] += S.dt * velocity[1]

        // Drop bomb
        this.reload[i] = Math.max(0, this.reload[i] - S.dt)
        if (control.dropBomb && this.reload[i] === 0) {
          sim.bombs.fire(
            [
              position[0] - (sinA * S.shipSize) / 2,
              position[1] - (cosA * S.shipSize) / 2,
            ],
            velocity,
            i,
          )
          this.reload[i] = S.shipReloadTime
        }
      } /* alive */ else {
        this.respawn[i] -= S.dt
        if (this.respawn[i] <= 0) {
          this.alive[i] = true
          this.reset(i)
        }
      }
    }
  }
}

export function createGridPattern(n: number): Vec2[] {
  const result = [] as Vec2[]
  for (let level = 0; result.length < n; ++level) {
    result.push([0, level])
    for (let i = 1; i <= level; ++i) {
      result.push([i, level], [-i, level])
    }
    for (let i = 0; i <= level; ++i) {
      result.push([level + 1, i], [-level - 1, i])
    }
  }
  return result.slice(0, n)
}

export class Sim {
  planet: Planet
  factories: Factories
  turrets: Turrets
  bullets: Bullets = new Bullets()
  bombs: Bombs = new Bombs()
  ships: Ships = new Ships()
  log: Record<string, unknown[]> = {
    left: [],
    right: [],
    retro: [],
    dropBomb: [],
    position: [],
    velocity: [],
    angle: [],
    angularVelocity: [],
  }

  constructor(level: LevelData) {
    this.planet = new Planet(level)
    this.factories = new Factories(level.factories, this.planet)
    this.turrets = new Turrets(level.turrets, this.planet)
    const height = -this.planet.height[0] - S.startAltitude
    this.ships.add([0, height])
    const grid = createGridPattern(1 + level.allies)
    for (let i = 0; i < level.allies; ++i) {
      this.ships.add([
        S.allySpacing * grid[i + 1][0],
        S.allySpacing * grid[i + 1][1],
      ])
    }
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
            if (distanceSq < (0.8 * S.shipSize) ** 2) {
              this.ships.kill(shipI, events)
              this.bullets.timeToLive[bulletI] = 0
            }
          }
        }
      }
    }
  }

  #log(): void {
    const index = 0
    for (const [k, v] of Object.entries(this.ships.control[index])) {
      this.log[k].push(+v)
    }
    this.log.position.push(
      this.ships.position[index].map((a) => Math.round(1000 * a) / 1000),
    )
    this.log.velocity.push(
      this.ships.velocity[index].map((a) => Math.round(1000 * a) / 1000),
    )
    // Angle requires higher resolution
    this.log.angle.push(Math.round(10000 * this.ships.angle[index]) / 10000)
    this.log.angularVelocity.push(
      Math.round(10000 * this.ships.angularVelocity[index]) / 10000,
    )
  }

  update(events: Events): void {
    this.#log()
    this.ships.update(this, events)
    this.turrets.update(this)
    this.bullets.update(this)
    this.bombs.update(this, events)
    this.#detectCollisions(events)
  }
}
