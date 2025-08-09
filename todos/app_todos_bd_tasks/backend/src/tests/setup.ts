import { beforeAll, afterAll } from 'vitest'

beforeAll(async () => {
  // Setup test database connection
  process.env.NODE_ENV = 'test'
  console.log('🧪 Test environment setup')
})

afterAll(async () => {
  // Cleanup after tests
  console.log('🧹 Test environment cleanup')
})