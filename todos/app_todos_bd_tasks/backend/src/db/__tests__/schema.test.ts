import { describe, it, expect } from 'vitest'
import { schema } from '../schema/index'

describe('Database Schema', () => {
  it('should export issues table', () => {
    expect(schema.issues).toBeDefined()
  })

  it('should export users table', () => {
    expect(schema.users).toBeDefined()
  })

  it.todo('should have proper foreign key relationships')
  it.todo('should have proper indexes defined')
})