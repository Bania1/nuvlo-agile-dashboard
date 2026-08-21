import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { atlassianAccountId: 'demo-account' },
    update: {},
    create: { atlassianAccountId: 'demo-account', email: 'demo@nuvlo.local', displayName: 'Demo Nuvlo' },
  });

  const project = await prisma.jiraProject.upsert({
    where: { cloudId_jiraId: { cloudId: 'demo-cloud', jiraId: '10000' } },
    update: {},
    create: { cloudId: 'demo-cloud', jiraId: '10000', key: 'TFG', name: 'Proyecto demo TFG' },
  });

  await prisma.analysisScope.create({
    data: {
      userId: user.id,
      projectId: project.id,
      name: 'Demo TFG',
      labels: [],
      issueTypes: ['Story', 'Task', 'Bug'],
      startStatuses: ['In Progress'],
      doneStatuses: ['Done'],
      effortField: 'Story Points',
      percentileMarks: [0.5, 0.85],
    },
  });
}

main().finally(async () => prisma.$disconnect());
