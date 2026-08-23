import { prisma } from '../db/prisma.js';
import { encryptSecret } from '../utils/crypto.js';

function tokenExpiryDate(expiresIn) {
  if (!expiresIn) return null;
  return new Date(Date.now() + Number(expiresIn) * 1000);
}

function pickJiraResource(resources) {
  return resources.find((resource) =>
    resource.url?.includes('.atlassian.net') && resource.scopes?.some((scope) => scope.includes('jira'))
  ) || resources[0];
}

export async function persistAtlassianLogin({ profile, tokenSet, resources }) {
  const resource = pickJiraResource(resources);
  if (!resource?.id) {
    const error = new Error('No Jira Cloud site available for this Atlassian account.');
    error.statusCode = 403;
    error.code = 'NO_JIRA_RESOURCE';
    throw error;
  }

  const accountId = profile.account_id || profile.accountId;
  if (!accountId) {
    const error = new Error('Atlassian profile did not include an account id.');
    error.statusCode = 502;
    error.code = 'INVALID_ATLASSIAN_PROFILE';
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { atlassianAccountId: accountId },
      update: {
        email: profile.email || profile.emailAddress || null,
        displayName: profile.name || profile.displayName || null,
      },
      create: {
        atlassianAccountId: accountId,
        email: profile.email || profile.emailAddress || null,
        displayName: profile.name || profile.displayName || null,
      },
    });

    const session = await tx.atlassianSession.upsert({
      where: { userId_cloudId: { userId: user.id, cloudId: resource.id } },
      update: {
        siteName: resource.name || null,
        siteUrl: resource.url || null,
        encryptedAccessToken: encryptSecret(tokenSet.access_token),
        encryptedRefreshToken: tokenSet.refresh_token ? encryptSecret(tokenSet.refresh_token) : null,
        scopes: resource.scopes || [],
        expiresAt: tokenExpiryDate(tokenSet.expires_in),
      },
      create: {
        userId: user.id,
        cloudId: resource.id,
        siteName: resource.name || null,
        siteUrl: resource.url || null,
        encryptedAccessToken: encryptSecret(tokenSet.access_token),
        encryptedRefreshToken: tokenSet.refresh_token ? encryptSecret(tokenSet.refresh_token) : null,
        scopes: resource.scopes || [],
        expiresAt: tokenExpiryDate(tokenSet.expires_in),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        eventType: 'AUTH',
        message: 'Inicio de sesion mediante Atlassian OAuth.',
        metadata: { cloudId: session.cloudId, siteUrl: session.siteUrl },
      },
    });

    return { user, atlassianSession: session };
  });
}

export async function getAuthenticatedUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      atlassianAccountId: true,
      email: true,
      displayName: true,
      sessions: {
        select: {
          cloudId: true,
          siteName: true,
          siteUrl: true,
          scopes: true,
          expiresAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}


export async function getLatestAtlassianSession(userId) {
  return prisma.atlassianSession.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}
