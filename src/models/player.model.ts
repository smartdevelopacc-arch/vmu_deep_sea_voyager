import { Schema, model, Document, Types } from 'mongoose'
import { defaultJSONTransform } from './model-utils';


export interface IPlayer extends Document {
    code: string,
    name: string,
    logo: string,
    slogan: string,
    secret?: string, // ✅ NEW: Secret token for authentication
    score: number,
    energy: number,
    position: { x: number, y: number },
    carriedTreasure?: number,
    trapCount?: number,
    moveHistory?: Array<{ turn: number, position: { x: number, y: number } }>
}

export const PlayerSchema = new Schema<IPlayer>({
    code: {type: String, required: true }, // Removed unique: true for embedded use in games
    name: { type: String, required: true},
    logo: { type: String, required: false},
    slogan: { type: String, required: false},
    secret: { type: String, required: false }, // ✅ NEW: Player secret for authentication
    score: { type: Number, required: false, default: 0},
    energy: { type: Number, required: false, default: 100 },
    position: {
        x: { type: Number, required: false },
        y: { type: Number, required: false }
    },
    carriedTreasure: { type: Number, required: false },
    trapCount: { type: Number, required: false, default: 0 },
    moveHistory: [{ turn: Number, position: { x: Number, y: Number } }]
}, {
    versionKey: false,

    toJSON: {
      virtuals: true,
      transform: defaultJSONTransform
    }
});

export const Player = model<IPlayer>('Player', PlayerSchema)