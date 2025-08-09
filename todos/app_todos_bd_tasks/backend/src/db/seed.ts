import { reset, seed } from "drizzle-seed";
import { db } from "./client.js";
import { schema } from "./schema/index.js";

console.time('Database reset')
await reset(db, { schema })
console.timeEnd('Database reset')

const oneDayAgo = new Date();
oneDayAgo.setDate(oneDayAgo.getDate() - 1);

console.time('Database seed')

await seed(db, schema).refine(f => {
  return {
    issues: {
      count: 10_000,
      columns: {
        title: f.loremIpsum({ sentencesCount: 1 }),
        description: f.loremIpsum({ sentencesCount: 6 }),
        createdAt: f.valuesFromArray({
          values: [
            oneDayAgo as any,
          ],
        })
      },
      with: {
        batchSize: 1000,
      }
    },

    users: {
      count: 5,
      columns: {
        name: f.fullName(),
      },
    },
  }
})

console.timeEnd('Database seed')
console.log('✅ Database seeded successfully!')