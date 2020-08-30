import { assertJSON } from './assert-json.js'

export function _collect(typeRec, spec) {
  const deployables = {}

  const markers = {}

  for (const typeName in typeRec) {
    markers[typeName] = (name, options) => {
      deployables[name] = { typeName, name, options }
      return { __ref: name }
    }
  }

  spec(markers)

  return deployables
}

// Deploy/update/undeploy

export async function deploy(typeRec/*, current */, spec) {
  const deployables = _collect(typeRec, spec)

  // Bunch of promises
  let tasks = {}

  const ctx = {
    refToName: name => {
      if (typeof name.__ref === 'string') name = name.__ref

      if (!(name in deployables)) {
        throw new Error('unknown deployable ' + JSON.stringify(name))
      }

      return name
    },
    getInterface: async (name) => {
      name = ctx.refToName(name)
      const { typeName, current } = await tasks[name]

      return await typeRec[typeName].getInterface(ctx, name, current)
    },
    depend: async name => {
      return await tasks[ctx.refToName(name)]
    }
  }

  for (const name in deployables) {
    tasks[name] = (async () => {
      const { typeName, options } = deployables[name]

      const current = await typeRec[typeName].deploy(ctx, name, options)

      return { typeName, name, current }
    })()
  }

  const deployedThings = await Promise.all(Object.values(tasks))

  let newState = {}

  for (const thing of Object.keys(tasks).sort()) {
    newState[thing] = deployedThings.find(t => t.name === thing)
  }

  return newState
}

export async function undeploy(typeRec, state) {
  const ctx = { }

  const undeployer = async ({
    typeName,
    name,
    current
  }) => {
    const type = typeRec[typeName]
    await type.undeploy(ctx, name, current)
  }

  const undeployTasks = Object.values(state).map(undeployer)

  await Promise.all(undeployTasks)
}
