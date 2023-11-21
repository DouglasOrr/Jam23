import * as Physics from "../src/physics"

test("angleBetween", () => {
  expect(Physics.angleBetween(2, 2.5)).toBeCloseTo(0.5)
  expect(Physics.angleBetween(2.5, 2)).toBeCloseTo(-0.5)
  expect(Physics.angleBetween(Math.PI - 0.1, -Math.PI + 0.2)).toBeCloseTo(0.3)
  expect(Physics.angleBetween(-Math.PI + 0.2, Math.PI - 0.1)).toBeCloseTo(-0.3)
})

test("rotateTowards", () => {
  expect(Physics.rotateTowards(1, 1.3, 0.1)).toBeCloseTo(1.1)
  expect(Physics.rotateTowards(1, 0.95, 0.1)).toBeCloseTo(0.95)
  // Past discontinuity
  expect(Physics.rotateTowards(3, -3, 0.1)).toBeCloseTo(3.1)
  expect(Physics.rotateTowards(3, -3, 0.4)).toBeCloseTo(-3)
  expect(Physics.rotateTowards(-3, 3, 0.1)).toBeCloseTo(-3.1)
  expect(Physics.rotateTowards(-3, 3, 0.4)).toBeCloseTo(3)
})

test("basic Physics.Sim", () => {
  const sim = new Physics.Sim({
    height: [0, 0, 10, 10, 5, 5, 5, 5, 5],
    spacing: 10,
    turrets: [[20, 10]],
    factories: [[45, 5]],
    friendlies: 0,
  })

  // First step is fine
  const events = new Physics.Events()
  sim.update(events)
  expect(events.explosions).toHaveLength(0)

  // No input for 5s -> ship should die by gravity
  for (let i = 0; i < 5 / Physics.S.dt && events.explosions.length === 0; ++i) {
    sim.update(events)
  }
  expect(events.explosions.length).toBe(1)
  expect(events.explosions[0]).toMatchObject(sim.ships.position[0])
  expect(sim.ships.alive[0]).toBe(false)
})
