import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
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
//
// The `data` union covers three distinct builder shapes:
//
//   SlashCommandBuilder
//     — a plain command with no subcommands (most commands).
//
//   Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
//     — used when a command adds options (e.g. addStringOption), which
//       returns this narrowed type to prevent mixing options and subcommands.
//
//   SlashCommandSubcommandsOnlyBuilder
//     — returned by .addSubcommand(), which prevents adding top-level options
//       afterward. Required for commands like /playlist that use subcommands.
// ---------------------------------------------------------------------------
export interface Command {
  data:
    | SlashCommandBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
    | SlashCommandSubcommandsOnlyBuilder;
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