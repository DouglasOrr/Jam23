import * as Physics from "../src/physics"

test("basic Physics.Sim", () => {
  const sim = new Physics.Sim({
    height: [0, 0, 10, 10, 5, 5, 5, 5, 5],
    spacing: 10,
    turrets: [[20, 10]],
  })
  // First step is fine
  sim.update(0.1)
  expect(sim.shipExplode).toBe(false)
  // No input for 5s, should die by gravity
  for (let i = 0; i < 50; ++i) {
    sim.update(0.1)
  }
  expect(sim.shipExplode).toBe(true)
})
