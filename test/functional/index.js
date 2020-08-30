import http from 'http'
import { strict as assert } from 'assert'
import fs from 'fs'
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'
import { deploy, undeploy } from "../../lib/index.js"
import path from 'path';

const relativePath = rel => path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  rel
)

const kvses = new Map()
const lambdas = new Map()
const servers = new Map()
const typeRec = {
  kvs: {
    deploy: (_, name, _options) => {
      kvses.set(name, new Map())
    },
    undeploy: (_, name) => {
      kvses.delete(name)
    },
    getInterface: (_, name, _current) => {
      const store = kvses.get(name)
      return {
        get: async (key) => store.get(key),
        set: async (key) => store.set(key),
        inc: async (key, n = 1) => {
          const newScore = (store.get(key) || 0) + n
          store.set(key, newScore)
          return newScore
        }
      }
    }
  },
  lambda: {
    deploy: async (_, name, { funcPath, args }) => {
      const code64 = fs.readFileSync(funcPath).toString('base64')
      const { func } = await import(
        'data:text/javascript;base64,' + code64
      )

      lambdas.set(name, func)

      return { funcPath, args }
    },
    undeploy: (_, name) => {
      lambdas.delete(name)
    },
    getInterface: async (ctx, name, current) => {
      let { args } = current
      const func = lambdas.get(name)

      const argsInterfaces = await Promise.all(args.map(a => ctx.getInterface(a)))

      return {
        call: async (...callArgs) => {
          return await func(...argsInterfaces, ...callArgs)
        }
      }
    },
  },
  simpleServer: {
    deploy: async (ctx, name, { func }) => {
      func = await ctx.getInterface(func)
      const server = http.createServer((req, res) => {
        const userId = new URL('http://x' + req.url).pathname.slice(1)

        func.call(userId)
          .then(newScore => res.end('' + newScore))
          .catch(err => res.end(`ERROR ${err.stack}`))
      })

      servers.set(name, server)

      return await new Promise((resolve, reject) => {
        server.listen(err => {
          if (err) return reject(err)

          resolve({
            address: `http://localhost:${server.address().port}`
          })
        })
      })
    },
    undeploy: async (_, name) => {
      const server = servers.get(name)

      if (!server) return

      return new Promise((resolve, reject) => {
        server.close(err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  }
}

const collector = ({ kvs, simpleServer, lambda }) => {
  const keyValueStore = kvs('keyValueStore')

  const func = lambda('scoreIncrementer', {
    funcPath: relativePath('lambda.js'),
    args: [keyValueStore]
  })

  simpleServer('server', { func })
}

describe('functional tests', () => {
  let state
  beforeEach(async () => {
    state = await deploy(typeRec, collector)
  })
  afterEach(async () => {
    await undeploy(typeRec, state)
  })

  it('deploys stuff in-memory', async () => {
    const get = async path => {
      const url = state.server.current.address + path
      const res = await fetch(url)
      return res.text()
    }

    assert.equal(await get('/score1'), '100')
    assert.equal(await get('/score1'), '200')
    assert.equal(await get('/score2'), '100')
    assert.equal(await get('/score1'), '300')
  })
})
