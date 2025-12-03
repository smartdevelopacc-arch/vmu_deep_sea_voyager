import { Schema, model, Document, Types } from 'mongoose'
import { defaultJSONTransform } from './model-utils';


export interface IMap extends Document {
    code: string,
    name: string,
    width: number,
    height: number,
    disable: boolean,
    terrain: number[][],
    treasures: number[][],
    traps: number[][],
    bases: number[][],
    waves: number[][],
    owners: string[][] | number[][], // Support both types for backward compatibility
    history?: Array<any>
}

export const MapSchema = new Schema<IMap>({
    code: {type: String, required: true, unique: true },
    name: { type: String, required: true},
    width: { type: Number, required: true, default: 50},
    height: { type: Number, required: true, default: 50},
    disable: { type: Boolean, required: true, default: false},
    terrain: {
        type: [[Number]],
        required: true,
    },
    traps: {
        type: [[Number]],
        required: true,
    },
    treasures: {
        type: [[Number]],
        required: true,
    },
    bases: {
        type: [[Number]],
        required: true,
    },
    waves: {
        type: [[Number]],
        required: false,
    },
    owners: {
        type: Schema.Types.Mixed, // Support both number[][] and string[][]
        required: false,
    },
    history: [{ type: Object }]
}, {
    versionKey: false,

    toJSON: {
      virtuals: true,
      transform: defaultJSONTransform
    }
})

MapSchema.virtual('layout').get(function(){
    const ret: number[][] = Array.from({ length: this.height}, () => 
       new Array(this.width).fill(0)
    )

    // Outer loop for ROWS (j or 'r' < height)
    for(let r = 0; r < this.height; r++){
        // Inner loop for COLUMNS (i or 'c' < width)
        for(let c = 0; c < this.width; c++){
            if (this.terrain[r][c] < 0)
                ret[r][c] = -1
            else
                ret[r][c] = this.terrain[r][c]
                        + this.treasures[r][c]
        }
    }
    return ret
})


export const Map = model<IMap>('Map', MapSchema)