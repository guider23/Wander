import { AttentionAppApi } from '../../electron/preload';

declare global {
  interface Window {
    attentionApp?: AttentionAppApi;
  }
}
