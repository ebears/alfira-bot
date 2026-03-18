import { getClient } from '@alfira-bot/bot';
import { GUILD_ID } from './config';

export async function getUserDisplayName(discordId: string): Promise<string> {
  const client = getClient();
  if (!client) return discordId;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    return member.displayName || member.user.username || discordId;
  } catch {
    return discordId;
  }
}
