<script>
    import { css } from 'styled-system/css';
    import Button from '$lib/components/atoms/Button.svelte';
    import Label from '$lib/components/atoms/Label.svelte';
    import PreviewBackground from '$lib/components/atoms/PreviewBackground.svelte';

    const variants = ['primary', 'secondary', 'accent', 'success', 'warning', 'alert', 'info', 'slate', 'glass', 'ghost', 'outline'];
    const sizes = ['sm', 'md', 'lg', 'xl'];
</script>

<div class={css({ position: 'relative', minH: 'screen', p: '8', bg: 'slate.300', rounded: '3xl', overflow: 'hidden' })}>
    <PreviewBackground dotColor="var(--colors-slate-400)" />

    <div class={css({ position: 'relative', zIndex: '10', display: 'flex', flexDirection: 'column', gap: '8' })}>
        
        <div class={css({ textAlign: 'center', mb: '8' })}>
            <h1 class={css({ fontSize: '4xl', fontWeight: 'bold', color: 'primary.800', fontFamily: 'title' })}>
                Generic Button
            </h1>
            <p class={css({ fontSize: 'lg', color: 'primary.600', mt: '2' })}>
                Fully rounded, multi-variant button component with icon support.
            </p>
        </div>

        <!-- Variants -->
        <section class={css({ bg: 'slate.100', p: '6', rounded: '2xl', border: '1px solid', borderColor: 'slate.200' })}>
            <Label size="lg" weight="bold" class={css({ mb: '4', display: 'block' })}>Variants</Label>
            <div class={css({ display: 'flex', flexWrap: 'wrap', gap: '4' })}>
                {#each variants as variant}
                    <Button {variant}>{variant}</Button>
                {/each}
            </div>
        </section>

        <!-- Sizes -->
        <section class={css({ bg: 'slate.100', p: '6', rounded: '2xl', border: '1px solid', borderColor: 'slate.200' })}>
            <Label size="lg" weight="bold" class={css({ mb: '4', display: 'block' })}>Sizes</Label>
            <div class={css({ display: 'flex', alignItems: 'center', gap: '4' })}>
                {#each sizes as size}
                    <Button variant="primary" {size}>Button {size}</Button>
                {/each}
            </div>
        </section>

        <!-- Icons -->
        <section class={css({ bg: 'slate.100', p: '6', rounded: '2xl', border: '1px solid', borderColor: 'slate.200' })}>
            <Label size="lg" weight="bold" class={css({ mb: '4', display: 'block' })}>Icons</Label>
            <div class={css({ display: 'flex', flexWrap: 'wrap', gap: '4', alignItems: 'center' })}>
                <Button variant="primary" icon="lucide:plus">Add New</Button>
                <Button variant="secondary" icon="lucide:arrow-right" iconPosition="right">Next Step</Button>
                <Button variant="accent" icon="lucide:star">Featured</Button>
                <Button variant="glass" icon="lucide:settings">Settings</Button>
            </div>
        </section>

        <!-- Icon Only -->
        <section class={css({ bg: 'slate.100', p: '6', rounded: '2xl', border: '1px solid', borderColor: 'slate.200' })}>
            <Label size="lg" weight="bold" class={css({ mb: '4', display: 'block' })}>Icon Only</Label>
            <div class={css({ display: 'flex', alignItems: 'center', gap: '4' })}>
                {#each sizes as size}
                    <Button variant="primary" {size} icon="lucide:heart" />
                {/each}
                <Button variant="alert" size="lg" icon="lucide:trash-2" />
                <Button variant="success" size="lg" icon="lucide:check" rounded="lg" />
            </div>
        </section>

        <!-- States -->
        <section class={css({ bg: 'slate.100', p: '6', rounded: '2xl', border: '1px solid', borderColor: 'slate.200' })}>
            <Label size="lg" weight="bold" class={css({ mb: '4', display: 'block' })}>States</Label>
            <div class={css({ display: 'flex', gap: '4' })}>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" state="active">Active State</Button>
            </div>
        </section>

    </div>
</div>

