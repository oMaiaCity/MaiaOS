import Label from '../components/atoms/Label.svelte';
import Badge from '../components/atoms/Badge.svelte';
import CallButton from '../components/atoms/CallButton.svelte';
import GlassIconButton from '../components/atoms/GlassIconButton.svelte';
import LeafInput from '../components/atoms/LeafInput.svelte';
import Button from '../components/atoms/Button.svelte';

export const componentRegistry = {
    Label,
    Badge,
    CallButton,
    IconButton: GlassIconButton,
    Input: LeafInput,
    Button // Generic Button
};

export const resolveComponent = (name) => {
    return componentRegistry[name] || null;
};
