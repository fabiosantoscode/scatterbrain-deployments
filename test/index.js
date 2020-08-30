import { strict as assert } from 'assert'
import { _collect as collect, deploy } from '../lib/index.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

describe('collect', () => {
  it('provides type creators which create temporary refs', () => {
    const theType = {}
    const typeRec = { theType }
    let theRef
    collect(typeRec, ({ theType }) => {
      theRef = theType('myTypeName', { params: true })
    })
    assert.deepEqual(theRef, { __ref: 'myTypeName' })
  })

  it('collects deployments from a typeRec', () => {
    const redis = {}
    const lambda = {}

    const typeRec = {
      redis,
      lambda
    }

    const deployment = collect(typeRec, ({ redis, lambda }) => {
      const myRedis = redis('myRedis')
      lambda('myLambda', { args: [myRedis]})
    })

    assert.deepEqual(deployment, {
      myRedis: { typeName: 'redis', name: 'myRedis', options: undefined },
      myLambda: { typeName: 'lambda', name: 'myLambda', options: { args: [{ __ref: 'myRedis' }] } }
    })
  })
})

describe('deploy', () => {
  const makeMockType = () => ({
    deploy: async (_, name, options) =>
      ({ name, options })
  })

  const typeRec = {
    db: makeMockType(),
    backend: makeMockType(),
  }

  const spec = (({ db, backend, frontend }) => {
    const myDb = db('myDb')
    const myBackend = backend('myBackend', {
      args: [db('myDb')]
    })
  })

  it('deploys a deployment spec', async () => {
    const { myDb, myBackend } = await deploy(typeRec, spec)

    assert.deepEqual(myDb, {
      typeName: 'db',
      name: 'myDb',
      current: { name: 'myDb', options: undefined }
    })
    assert.deepEqual(myBackend.current, {
      name: 'myBackend',
      options: {
        args: [{__ref: 'myDb'}]
      }
    })
  })

  it('provides depend() function to wait for another deployment', async () => {
    const deployedOrder = []
    let dependData
    const typeRec = {
      db: {
        async deploy(ctx) {
          await sleep(5)
          deployedOrder.push('db')
        }
      },
      backend: {
        async deploy(ctx, _, { args: [db]}) {
          dependData = await ctx.depend(db)
          deployedOrder.push('backend')
        }
      }
    }

    await deploy(typeRec, spec)

    assert.deepEqual(deployedOrder, ['db', 'backend'])
    assert.deepEqual(dependData, {
      typeName: 'db',
      name: 'myDb',
      current: undefined
    })
  })
})
