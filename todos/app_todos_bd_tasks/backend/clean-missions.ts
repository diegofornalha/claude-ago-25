import { db } from './src/db/client'
import { missions } from './src/db/schema/missions'
import { eq } from 'drizzle-orm'

async function cleanMissions() {
  // Deletar missões com erro
  const errorMissions = [1, 2, 4]; // IDs das missões com erro
  
  for (const id of errorMissions) {
    await db.delete(missions).where(eq(missions.id, id))
    console.log(`Missão ${id} deletada`)
  }
  
  console.log('\nMissões restantes:')
  const remaining = await db.select().from(missions)
  remaining.forEach(m => {
    console.log(`ID: ${m.id}, Título: ${m.title}, Status: ${m.status}`)
  })
  
  process.exit(0)
}

cleanMissions()