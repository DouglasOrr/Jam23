import * as Physics from "./physics"
import * as T from "./tensors"
import { NdArray } from "./ndarray"

// Script

export class ScriptAgent {
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

// Machine learning

export function getNormalisedFeature(
  position: Physics.Vec2,
  velocity: Physics.Vec2,
  angle: number,
  angularVelocity: number,
  targetVelocity: Physics.Vec2,
): number[] {
  const maxAngularVelocity = 3
  const maxVelocity = 30

  const bearing = Math.atan2(-position[0], position[1])
  const sinB = Math.sin(bearing)
  const cosB = Math.cos(bearing)
  const polarAngle = Physics.angleBetween(bearing, angle)
  const velocityR = velocity[0] * -sinB + velocity[1] * cosB
  const velocityTheta = velocity[0] * -cosB + velocity[1] * -sinB
  const targetVelocityR = targetVelocity[0] * -sinB + targetVelocity[1] * cosB
  const targetVelocityTheta =
    targetVelocity[0] * -cosB + targetVelocity[1] * -sinB

  return [
    polarAngle / Math.PI,
    angularVelocity / maxAngularVelocity,
    velocityR / maxVelocity,
    velocityTheta / maxVelocity,
    targetVelocityR / maxVelocity,
    targetVelocityTheta / maxVelocity,
  ]
}

export function encodeFeature(
  nFrequencies: number,
  feature: number[],
): number[] {
  const result: number[] = []
  for (let i = 0; i < feature.length; ++i) {
    const value = feature[i]
    for (let j = 0; j < nFrequencies / 2; ++j) {
      const alpha = value * Math.PI * 0.5 * Math.pow(2, j)
      result.push(Math.sin(alpha), Math.cos(alpha))
    }
  }
  return result
}

export class Model {
  nFrequencies: number
  layers: T.Tensor[]

  constructor(nFrequencies: number, hiddenSize: number, weights: number[][]) {
    this.nFrequencies = nFrequencies
    this.layers = []
    for (let i = 0; i < weights.length; ++i) {
      const inputSize = i === 0 ? 6 * nFrequencies : hiddenSize
      const outputSize = i < weights.length - 1 ? hiddenSize : 3
      this.layers.push(
        new T.Tensor(new NdArray([inputSize, outputSize], weights[i])),
      )
    }
  }

  predict(feature: number[]): number[] {
    const encodedData = encodeFeature(this.nFrequencies, feature)
    let x = new T.Tensor(new NdArray([1, encodedData.length], encodedData))
    for (let i = 0; i < this.layers.length; ++i) {
      x = T.dot(x, this.layers[i])
      if (i === this.layers.length - 1) {
        x = T.sigmoid(x)
      } else {
        x = T.relu(x)
      }
    }
    return x.data.data
  }
}

export class LearningAgent {
  index: number
  model: Model
  targetVelocity: Physics.Vec2

  constructor(index: number, spec: Record<string, unknown>) {
    this.index = index
    this.model = new Model(
      spec.n_frequencies as number,
      spec.hidden_size as number,
      spec.weights as number[][],
    )
    this.targetVelocity = [0, 0]
  }

  update(sim: Physics.Sim): void {
    if (sim.ships.alive[this.index]) {
      const signal = this.model.predict(
        getNormalisedFeature(
          sim.ships.position[this.index],
          sim.ships.velocity[this.index],
          sim.ships.angle[this.index],
          sim.ships.angularVelocity[this.index],
          this.targetVelocity,
        ),
      )
      const control = sim.ships.control[this.index]
      control.left = Math.random() < signal[0]
      control.right = Math.random() < signal[1]
      control.retro = Math.random() < signal[2]
      control.dropBomb = false // TODO
    }
  }
}
