import type { Command } from '../types';
import { joinCommand } from './join';
import { leaveCommand } from './leave';
import { loopCommand } from './loop';
import { nowplayingCommand } from './nowplaying';
import { pauseCommand } from './pause';
import { playCommand } from './play';
import { playlistCommand } from './playlist';
import { queueCommand } from './queue';
import { shuffleCommand } from './shuffle';
import { skipCommand } from './skip';

export const commands: Command[] = [
  joinCommand,
  leaveCommand,
  playCommand,
  skipCommand,
  pauseCommand,
  loopCommand,
  shuffleCommand,
  queueCommand,
  nowplayingCommand,
  playlistCommand,
];
