import { getClient } from '@alfira-bot/bot';
import { GUILD_ID } from './config';

export async function getUserDisplayName(discordId: string): Promise<string> {
  const client = getClient();
  if (!client) return discordId;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.resolve(discordId);
    if (!member) return discordId;
    // GuildMemberStructure has 'nick' (server nickname) and the user object
    const user = member.user;
    return member.displayName || user.username || discordId;
  } catch {
    return discordId;
  }
}
