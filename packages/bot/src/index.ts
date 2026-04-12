import { logger } from '@alfira-bot/shared/logger';
import { Client, createEvent } from 'seyfert';
import { getHoshimi, setClient, setHoshimi } from './lib/client';
import { getPlayer } from './player/manager';

export type { DestroyReasons } from 'hoshimi';
export { broadcastQueueUpdate, setBroadcastQueueUpdate } from './lib/broadcast';
export { getClient, getHoshimi } from './lib/client';
export { VOICE_CONNECTION_TIMEOUT_MS } from './lib/constants';
export type { GuildPlayer } from './player/GuildPlayer';
export { createPlayer, destroyAllPlayers, getPlayer } from './player/manager';
export {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
  type PlaylistMetadata,
} from './utils/nodelink';

const NODELINK_URL = process.env.NODELINK_URL ?? 'http://localhost:2333';
const NODELINK_AUTH = process.env.NODELINK_AUTHORIZATION ?? '';

function parseNodeLinkUrl(url: string): { host: string; port: number; secure: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 2333),
    secure: parsed.protocol === 'https:',
  };
}

// Voice channel membership tracking for auto-pause.
// Maps voiceChannelId -> Set of human userIds currently in that channel.
const humanVoiceMembers = new Map<string, Set<string>>();

// Forward raw gateway packets to hoshimi so it can handle voice server updates.
const rawEvent = createEvent({
  data: { name: 'raw' as const },
  run(packet, _client) {
    const hoshimi = getHoshimi();
    if (!hoshimi) return;
    // hoshimi expects GatewayDispatchPayload but Seyfert passes it with extra wrapper;
    // the raw packet has `t` and `d` properties that hoshimi reads directly
    hoshimi.updateVoiceState(packet as Parameters<typeof hoshimi.updateVoiceState>[0]);

    // Track human users in voice channels for auto-pause.
    if (packet.t === 'VOICE_STATE_UPDATE') {
      const d = packet.d as {
        guild_id: string;
        user_id: string;
        channel_id: string | null;
        member?: { user?: { bot?: boolean } };
      };
      const _guildId = d.guild_id;
      const userId = d.user_id;
      const channelId = d.channel_id;
      const isBot = d.member?.user?.bot === true;

      // Update human voice membership tracking.
      // For disconnects (channelId === null), we rely on the member data being present
      // in the raw payload before cache updates.
      if (channelId === null) {
        // User left a channel - remove from all channel tracking.
        for (const [_chId, members] of humanVoiceMembers) {
          members.delete(userId);
        }
      } else if (!isBot) {
        // Non-bot user joined or stayed in a channel.
        let members = humanVoiceMembers.get(channelId);
        if (!members) {
          members = new Set();
          humanVoiceMembers.set(channelId, members);
        }
        members.add(userId);
      }
    }
  },
});

// Auto-pause: when all humans leave the bot's voice channel.
const voiceStateUpdateEvent = createEvent({
  data: { name: 'voiceStateUpdate' as const },
  run(state, oldState, _client) {
    // Seyfert passes [state] or [state, oldState]; destructure appropriately.
    const currentState = Array.isArray(state) ? state[0] : state;
    const previousState = Array.isArray(state) ? state[1] : oldState;

    // Ignore if both old and new state have no channel change.
    const oldChannelId = (previousState as { channelId: string | null } | undefined)?.channelId;
    const newChannelId = (currentState as { channelId: string | null }).channelId;
    if (oldChannelId === newChannelId) return;

    const guildId =
      (currentState as { guildId: string }).guildId ??
      (previousState as { guildId?: string })?.guildId;
    if (!guildId) return;

    const hoshimi = getHoshimi();
    if (!hoshimi) return;

    const player = hoshimi.players.get(guildId);
    if (!player) return;

    const botChannelId = player.voiceId;
    if (!botChannelId) return;

    // Check if someone left the bot's channel.
    const leftBotChannel = oldChannelId === botChannelId && newChannelId !== botChannelId;
    if (!leftBotChannel) return;

    // Determine if the leaving user was a human.
    // The raw event may have added them to humanVoiceMembers. If not found there,
    // we check via the member's user object.
    let wasHuman =
      humanVoiceMembers.get(botChannelId)?.has((currentState as { userId: string }).userId) ??
      false;
    const previousStateWithMember = previousState as
      | { member?: { user?: { bot?: boolean } } }
      | undefined;
    if (!wasHuman && previousStateWithMember?.member) {
      wasHuman = !(previousStateWithMember.member?.user?.bot === true);
    }

    if (!wasHuman) return;

    // Count remaining humans in the bot's voice channel.
    const channelMembers = humanVoiceMembers.get(botChannelId);
    const humanCount = channelMembers?.size ?? 0;

    if (humanCount === 0) {
      const guildPlayer = getPlayer(guildId);
      if (guildPlayer?.getCurrentSong() && guildPlayer.isPlaying()) {
        guildPlayer.togglePause();
        logger.info({ guildId }, "Auto-paused: no humans left in the bot's voice channel.");
      }
    }
  },
});

const readyEvent = createEvent({
  data: { name: 'ready' as const, once: true },
  run(user, _client) {
    const hoshimi = getHoshimi();
    if (hoshimi) {
      hoshimi.init({ id: user.id, username: user.username });
    }
    logger.info(`Bot logged in as ${user.username}`);
  },
});

/** Initializes and connects the Discord bot. Called by the API entry point. */
export async function startBot(): Promise<void> {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN is not set.');
  }

  // GatewayIntentBits.Guilds = 1, GuildVoiceStates = 128
  const intents = 1 | 128;

  const client = new Client({
    // Provide a minimal getRC to avoid needing a seyfert.config file.
    // Locations are empty since we set events programmatically.
    getRC: async () => ({
      token: DISCORD_BOT_TOKEN,
      locations: { base: '' },
      intents,
      debug: false,
    }),
  });

  setClient(client);

  // Initialize Hoshimi manager for audio.
  const { Hoshimi } = await import('hoshimi');
  const nodeConfig = parseNodeLinkUrl(NODELINK_URL);

  const hoshimi = new Hoshimi({
    sendPayload: (guildId: string, payload: unknown) => {
      const shardId = client.gateway.calculateShardId(guildId);
      // @ts-expect-error - hoshimi sends raw gateway payloads; gateway accepts them at runtime
      client.gateway.send(shardId, payload);
    },
    nodes: [
      {
        host: nodeConfig.host,
        port: nodeConfig.port,
        password: NODELINK_AUTH,
        secure: nodeConfig.secure,
      },
    ],
    client: {
      id: '',
      username: '',
    },
  });

  setHoshimi(hoshimi);

  await client.start();

  // Register events after start.
  // biome-ignore lint/suspicious/noExplicitAny: createEvent return has `once?: boolean` but ClientEvent needs `once: boolean`; values are correct at runtime
  client.events.set([readyEvent, rawEvent, voiceStateUpdateEvent] as any);
}
