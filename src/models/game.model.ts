import { Schema, model, Document, Types } from 'mongoose'
import { defaultJSONTransform } from './model-utils';
import { IMap, MapSchema } from './map.model';
import { IPlayer, PlayerSchema } from './player.model';


export interface IGame extends Document {
    code: string,
    name: string,
    disable: boolean,
    secret_key: string,
    map: IMap,  // Initial config - không đổi sau khi init
    runtimeState?: {  // State đang chạy - clone từ map khi start
        treasures: number[][],
        owners: string[][],
        traps: any[]
    },
    players: IPlayer[],
    status: 'waiting' | 'playing' | 'finished',
    currentTurn: number,
    startTime?: number,
    startedAt?: Date,
    endedAt?: Date,
    scores?: Array<{ playerId: string, score: number }>,
    history?: Array<any>,
    settings?: {
        enableTraps?: boolean,
        maxEnergy?: number,
        energyRestore?: number,
        maxTurns?: number,
        timeLimitMs?: number,
        tickIntervalMs?: number
    }
}

const GameSchema = new Schema<IGame>({
    code: {type: String, required: true, unique: true },
    name: { type: String, required: true},
    disable: { type: Boolean, required: true, default: false},
    secret_key: { type: String, required: true},
    map: {
      type: MapSchema,
      required: true
    },
    runtimeState: {
      type: {
        treasures: [[Number]],
        owners: [[String]],
        traps: [{ type: Object }]
      },
      required: false
    },
    players: {
      type: [PlayerSchema],
      required: true
    },
    status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    currentTurn: { type: Number, default: 0 },
    startTime: { type: Number },
    startedAt: { type: Date },
    endedAt: { type: Date },
    scores: [{ playerId: String, score: Number }],
    history: [{ type: Object }],
    settings: {
        type: {
            enableTraps: { type: Boolean, default: true },
            maxEnergy: { type: Number },
            energyRestore: { type: Number },
            maxTurns: { type: Number },
            timeLimitMs: { type: Number },
            tickIntervalMs: { type: Number } // ✅ ADDED - was missing from schema!
        },
        default: {}
    }
}, {
    versionKey: false,

    toJSON: {
      virtuals: true,
      transform: defaultJSONTransform
    }
});

GameSchema.virtual('leaderBoard').get(function() {
  if (!this.players || this.players.length === 0) {
    return [];
  }
  return [...this.players].sort((a, b) => b.score - a.score);
})


export const GameModel = model<IGame>('Game', GameSchema)