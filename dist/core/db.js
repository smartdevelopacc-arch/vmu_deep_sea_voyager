"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// Optional: verbose env debug when missing MONGO_URI
function debugEnvIfMissing() {
    if (!process.env.MONGO_URI) {
        console.error('Environment variables loaded keys:', Object.keys(process.env).filter(k => k.startsWith('MONGO') || k.startsWith('GAME_') || k === 'PORT' || k === 'NODE_ENV'));
        console.error('Working directory:', process.cwd());
    }
}
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            debugEnvIfMissing();
            throw new Error('MONGO_URI is not defined in environment variables');
        }
        await mongoose_1.default.connect(mongoUri);
        console.log('✅ MongoDB connected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
