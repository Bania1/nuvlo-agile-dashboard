import { prisma } from '../db/prisma.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';
import { refreshAccessToken } from './atlassianOAuth.js';

function tokenExpiryDate(expiresIn) {
  if (!expiresIn) return null;
  return new Date(Date.now() + Number(expiresIn) * 1000);
}

function pickJiraResource(resources) {
  return resources.find((resource) =>
    resource.url?.includes('.atlassian.net') && resource.scopes?.some((scope) => scope.includes('jira'))
  ) || resources[0];
}

// Crea o actualiza el usuario local a partir de Atlassian; Nuvlo no guarda passwords propios.
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

export async function getActiveAtlassianAccess(userId) {
  const atlassianSession = await getLatestAtlassianSession(userId);
  if (!atlassianSession) {
    const error = new Error('Atlassian session not found.');
    error.statusCode = 404;
    error.code = 'ATLASSIAN_SESSION_NOT_FOUND';
    throw error;
  }

  const activeSession = atlassianSession.expiresAt && atlassianSession.expiresAt <= new Date()
    ? await refreshAtlassianSession(atlassianSession)
    : atlassianSession;

  return {
    atlassianSession: activeSession,
    accessToken: decryptSecret(activeSession.encryptedAccessToken),
  };
}

// Atlassian usa refresh tokens rotatorios: si llega uno nuevo, reemplaza al anterior cifrado.
export async function refreshAtlassianSession(atlassianSession) {
  if (!atlassianSession.encryptedRefreshToken) {
    const error = new Error('Atlassian refresh token is not available.');
    error.statusCode = 401;
    error.code = 'ATLASSIAN_REFRESH_TOKEN_MISSING';
    throw error;
  }

  const tokenSet = await refreshAccessToken(decryptSecret(atlassianSession.encryptedRefreshToken));
  const updated = await prisma.atlassianSession.update({
    where: { id: atlassianSession.id },
    data: {
      encryptedAccessToken: encryptSecret(tokenSet.access_token),
      encryptedRefreshToken: tokenSet.refresh_token
        ? encryptSecret(tokenSet.refresh_token)
        : atlassianSession.encryptedRefreshToken,
      expiresAt: tokenExpiryDate(tokenSet.expires_in),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: atlassianSession.userId,
      eventType: 'AUTH',
      message: 'Token Atlassian renovado mediante refresh token rotatorio.',
      metadata: { cloudId: atlassianSession.cloudId },
    },
  });

  return updated;
}
