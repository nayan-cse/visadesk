import {handle} from '../src/handler.js';
export function GET(request) { return handle(request, process.env, '/api/check-status'); }
export function POST(request) { return handle(request, process.env, '/api/check-status'); }
