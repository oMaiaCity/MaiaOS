import { mount } from 'svelte';
import AuthPopup from './AuthPopup.svelte';
import './app.css';

const app = mount(AuthPopup, {
  target: document.getElementById('app')!,
});

export default app;

