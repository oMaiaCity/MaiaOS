import Label from '../components/leafs/Label.svelte';
import Badge from '../components/leafs/Badge.svelte';
import CallButton from '../components/leafs/CallButton.svelte';
import GlassIconButton from '../components/leafs/GlassIconButton.svelte';
import Input from '../components/leafs/Input.svelte';
import Button from '../components/leafs/Button.svelte';

export const componentRegistry = {
    Label,
    Badge,
    CallButton,
    IconButton: GlassIconButton,
    Input,
    Button // Generic Button
};

export const resolveComponent = (name) => {
    return componentRegistry[name] || null;
};
