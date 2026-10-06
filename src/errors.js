export class TrackerError extends Error {
 constructor(message, code, {status=422, retryable=false, needsNewCaptcha=false, upstreamStatus}={}) {
  super(message);
  this.name='TrackerError';
  Object.assign(this,{code,status,retryable,needsNewCaptcha,upstreamStatus});
 }
}

export const failure = (message,code,options)=>new TrackerError(message,code,options);
