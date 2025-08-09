import { relations } from 'drizzle-orm';
import { users } from './users';
import { issues } from './issues';

// Define relations between tables
export const usersRelations = relations(users, ({ many }) => ({
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one }) => ({
  user: one(users, {
    fields: [issues.userId],
    references: [users.id],
  }),
}));