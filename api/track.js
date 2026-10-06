import {handle} from '../src/handler.js';
export function GET(request){return handle(request,process.env);}
export function POST(request){return handle(request,process.env);}
