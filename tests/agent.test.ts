import * as Agent from "../src/agent"
import { S } from "../src/agent"

test("getNormalisedFeature", () => {
  const f = Agent.getNormalisedFeature(
    /* position */ [0, -10],
    /* velocity */ [6, -3],
    /* angle */ (-3 / 4) * Math.PI,
    /* angularVelocity */ -1,
    /* targetVelocity */ [0, 1000],
  )
  expect(f[0]).toBeCloseTo(0.25) // polarAngle: 1/4 turn to the right
  expect(f[1]).toBeCloseTo(-1 / S.maxAngularVelocity) // polarVelocity
  expect(f[2]).toBeCloseTo(3 / S.maxVelocity) // velocity.R
  expect(f[3]).toBeCloseTo(6 / S.maxVelocity) // velocity.theta
  expect(f[4]).toBeCloseTo(-1) // targetVelocity.R (clipped)
  expect(f[5]).toBeCloseTo(0) // targetVelocity.theta
})
