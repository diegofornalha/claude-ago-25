import { db } from './src/db/client'
import { missions } from './src/db/schema/missions'
import { eq } from 'drizzle-orm'

async function fixMission() {
  // Atualizar missão 5 para completed
  await db.update(missions)
    .set({ 
      status: 'completed',
      response: 'Missão processada com sucesso. 5 tarefas criadas.',
      updatedAt: new Date()
    })
    .where(eq(missions.id, 5))

  console.log('Missão 5 atualizada para completed')

  // Ver status de todas as missões
  const allMissions = await db.select().from(missions)
  console.log('\nTodas as missões:')
  allMissions.forEach(m => {
    console.log(`ID: ${m.id}, Título: ${m.title}, Status: ${m.status}`)
  })
  
  process.exit(0)
}

fixMission()