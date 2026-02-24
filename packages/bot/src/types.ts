import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Collection,
  Client,
} from 'discord.js';

// ---------------------------------------------------------------------------
// Re-export shared types so existing bot code that imports from './types'
// continues to work without changes. The canonical definitions live in
// @discord-music-bot/shared.
// ---------------------------------------------------------------------------
export type { Song, QueuedSong, LoopMode, QueueState } from '@discord-music-bot/shared';

// ---------------------------------------------------------------------------
// Command interface
// Every slash command must export an object matching this shape.
// ---------------------------------------------------------------------------
export interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Augment the discord.js Client type to include our commands collection.
// ---------------------------------------------------------------------------
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
