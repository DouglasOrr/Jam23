import * as Physics from "../src/physics"

test("basic Physics.Sim", () => {
  const sim = new Physics.Sim({
    height: [0, 0, 10, 10, 5, 5, 5, 5, 5],
    spacing: 10,
    turrets: [[20, 10]],
  })

  // First step is fine
  expect(sim.update(0.1).explosions).toHaveLength(0)

  // No input for 5s -> ship should die by gravity
  let explosions: Physics.Vec2[] = []
  for (let i = 0; i < 50 && explosions.length === 0; ++i) {
    explosions = sim.update(0.1).explosions
  }
  expect(explosions.length).toBe(1)
  expect(explosions[0]).toMatchObject(sim.ships.position[0])
  expect(sim.ships.alive[0]).toBe(false)
})
