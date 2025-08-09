import { PGlite } from '@electric-sql/pglite'
import { electricSync } from '@electric-sql/pglite-sync'

export const pg = await PGlite.create({
  dataDir: 'idb://example-electric',
  extensions: {
    electric: electricSync({ debug: true }),
  },
})

// await pg.electric.syncShapeToTable({
//   shapeKey: 'issues',
//   shape: {
//     url: 'http://localhost:3000/v1/shape',
//     params: {
//       table: 'issues',
//     },
//   },
//   table: 'issues',
//   primaryKey: ['id'],
// })
