import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function compileMigrations() {
  const migrations = readMigrationFiles({
    migrationsFolder: join(__dirname, 'migrations'),
  })

  await fs.writeFile(
    join(new URL('.', import.meta.url).pathname, 'migrations.json'),
    JSON.stringify(migrations, null, 2)
  )

  console.log('Migrations compiled!')
}

compileMigrations().catch(console.error)
