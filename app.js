import { loadRegistries } from './js/data/index.js';

loadRegistries().then((registries) => {
  console.log('DSP registries loaded:', registries);
});
