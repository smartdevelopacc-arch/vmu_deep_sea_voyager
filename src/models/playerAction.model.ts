import { Schema, model, Document } from 'mongoose';
import { defaultJSONTransform } from './model-utils';

export interface IPlayerAction extends Document {
  gameId: string;
  playerId: string;
  actionType: 'move' | 'trap' | 'rest';
  data?: any;
  status: 'pending' | 'processed' | 'failed';
  timestamp: Date;
  processedAt?: Date;
  error?: string;
}

const PlayerActionSchema = new Schema<IPlayerAction>({
  gameId: { type: String, required: true, index: true },
  playerId: { type: String, required: true, index: true },
  actionType: { 
    type: String, 
    required: true,
    enum: ['move', 'trap', 'rest']
  },
  data: { type: Schema.Types.Mixed },
  status: { 
    type: String, 
    required: true,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending',
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true },
  processedAt: { type: Date },
  error: { type: String }
}, {
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: defaultJSONTransform
  }
});

// Compound index cho query hiệu quả
PlayerActionSchema.index({ gameId: 1, status: 1, timestamp: 1 });

export const PlayerActionModel = model<IPlayerAction>('PlayerAction', PlayerActionSchema);
